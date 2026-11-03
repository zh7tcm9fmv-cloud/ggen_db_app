/* Master League turn rules — ported from gge-simulator.jp decoded battle.js:
   getDistance (Manhattan+size), getReachableCells / getBestMoveDestination (4-dir BFS),
   achievableTargets → lowest HP, calcSupportDefendLimit / cover search, evaluatePilotSkills.
   Damage numbers stay in the page (/cal). */
(function (root) {
  'use strict';

  /* Combat RNG — ml_sim injects simRandom so optimizer + SIMULATION START share one seed. */
  var randomFn = function () { return Math.random(); };
  function setRandom(fn) {
    randomFn = typeof fn === 'function' ? fn : function () { return Math.random(); };
  }
  function nextRandom() {
    try { return randomFn(); } catch (e) { return Math.random(); }
  }

  function unitSize(u) {
    if (!u) return 1;
    if (u.size != null) return Math.max(1, u.size | 0);
    return u.isLarge ? 2 : 1;
  }

  /** gge getDistance — orthogonal gap between footprints (NOT Chebyshev). */
  function distance(u1, u2) {
    var s1 = unitSize(u1);
    var s2 = unitSize(u2);
    var x1 = u1.x | 0;
    var y1 = u1.y | 0;
    var x2 = u2.x | 0;
    var y2 = u2.y | 0;
    var xDist = Math.max(0, x1 - (x2 + s2 - 1), x2 - (x1 + s1 - 1));
    var yDist = Math.max(0, y1 - (y2 + s2 - 1), y2 - (y1 + s1 - 1));
    return xDist + yDist;
  }

  function checkOverlap(x1, y1, size1, x2, y2, size2) {
    return x1 <= x2 + size2 - 1 && x1 + size1 - 1 >= x2 &&
      y1 <= y2 + size2 - 1 && y1 + size1 - 1 >= y2;
  }

  function alive(units) {
    return (units || []).filter(function (u) { return u && (u.hp | 0) > 0; });
  }

  function actionOrder(units) {
    return alive(units).map(function (u, i) {
      return { u: u, i: i, key: (u.mobility | 0) + (u.reaction | 0) };
    }).sort(function (a, b) {
      if (b.key !== a.key) return b.key - a.key;
      return a.i - b.i;
    }).map(function (row) { return row.u; });
  }

  function isMapWeapon(w) {
    return !!(w && (w.is_map || w.is_map_weapon || (w.raw && (w.raw.is_map || w.raw.is_map_weapon))));
  }

  function weaponEffectBlob(w) {
    var parts = [];
    var raw = w && w.raw ? w.raw : w;
    var i, t;
    if (!raw) return '';
    if (raw.traits) {
      for (i = 0; i < raw.traits.length; i++) {
        t = raw.traits[i];
        parts.push(typeof t === 'string' ? t : (t && (t.text || t.name)) || '');
      }
    }
    if (w && w.traits) {
      for (i = 0; i < w.traits.length; i++) {
        t = w.traits[i];
        parts.push(typeof t === 'string' ? t : (t && (t.text || t.name)) || '');
      }
    }
    if (raw.usage_restrictions) parts.push(raw.usage_restrictions.join(' '));
    if (w && w.usage_restrictions) parts.push((w.usage_restrictions || []).join(' '));
    if (raw.effect) parts.push(String(raw.effect));
    if (w && w.effect) parts.push(String(w.effect));
    return parts.join(' ');
  }

  /**
   * gge getWeaponRangeBonus — Range Boost skill + passive max-range +N
   * (skips Support-only range lines unless isSupport).
   */
  function getWeaponRangeBonus(actor, weapon, isSupport) {
    var rangeUp = 0;
    var bags, i, t, m, hpM, hpRatio, add;
    if (actor && actor.activeSkills) {
      actor.activeSkills.forEach(function (s) {
        if (!s || !/Range\s*Boost|レンジブースト|射程/i.test(String(s.name || ''))) return;
        m = String(s.effect || s.name || '').match(/(\d+)/);
        rangeUp += m ? (parseInt(m[1], 10) || 1) : 1;
      });
    }
    bags = abilityTextBags(actor);
    hpRatio = (actor && actor.maxHp) ? ((actor.hp | 0) / Math.max(1, actor.maxHp | 0)) : 1;
    for (i = 0; i < bags.length; i++) {
      t = normalizeFullwidth(bags[i].text);
      if (!isSupport && /支援攻撃|支援反撃|支援攻擊|支援反擊|Support\s*Attack|Support\s*Counter/i.test(t)
          && /最大射程|max(?:imum)?\s*range|射程/i.test(t)) continue;
      m = t.match(/最大射程[^0-9]*?(\d+)|max(?:imum)?\s*range[^0-9]*?[+＋]?(\d+)|射程\s*[+＋](\d+)/i);
      if (!m) continue;
      if (!tensionOk(actor && actor.mp, t)) continue;
      /* Cond:Vigor Special Weapon Max Range — only special weapons. */
      if (/special\s+weapon|特殊武装|特殊武裝|特殊武器/i.test(t) && !weaponIsSpecial(weapon)) continue;
      if (/HP(?:が)?満タン|HP\s*(?:at\s*)?full/i.test(t) && hpRatio < 0.999) continue;
      hpM = t.match(/HP(?:が)?(\d+)%以上|HP\s*(\d+)%\+/i);
      if (hpM && hpRatio * 100 < (parseInt(hpM[1] || hpM[2], 10) || 0)) continue;
      add = parseInt(m[1] || m[2] || m[3], 10);
      rangeUp += add > 0 ? add : 1;
    }
    return rangeUp;
  }

  function weaponsInRange(attacker, defender, isSupport) {
    var dist = distance(attacker, defender);
    return (attacker.weapons || []).filter(function (w) {
      var mn, mx, bonus;
      if (isMapWeapon(w)) return false;
      mn = w.min_range != null ? w.min_range | 0 : 1;
      mx = w.max_range != null ? w.max_range | 0 : mn;
      bonus = getWeaponRangeBonus(attacker, w, !!isSupport);
      return dist >= mn && dist <= (mx + bonus);
    });
  }

  /* Last-call cache: pickEngage + MAP + move all BFS the same actor/board state. */
  var _reachCacheKey = '';
  var _reachCacheCells = null;

  /**
   * gge getReachableCells — 4-dir BFS. Allies are passable; enemies block.
   * bounds: {minX,maxX,minY,maxY}
   */
  function getReachableCells(actor, maxMove, allUnits, bounds) {
    var startX = actor.x | 0;
    var startY = actor.y | 0;
    var size = unitSize(actor);
    var move = Math.max(0, maxMove | 0);
    var queue = [{ x: startX, y: startY, cost: 0 }];
    var visited = {};
    var reachable = [];
    var head = 0;
    var curr, dirs, t, nx, ny, key, blocked, u, isOcc, i, fp, cacheKey;
    visited[startX + ',' + startY] = 1;
    bounds = bounds || { minX: 0, maxX: 16, minY: 0, maxY: 15 };

    fp = '';
    for (i = 0; i < (allUnits || []).length; i++) {
      u = allUnits[i];
      if (!u) continue;
      fp += (u.id || i) + ':' + (u.x | 0) + ',' + (u.y | 0) + ',' + ((u.hp | 0) > 0 ? 1 : 0) + ';';
    }
    cacheKey = (actor.id || '') + '@' + startX + ',' + startY + '/' + move + '/' +
      (bounds.minX | 0) + ',' + (bounds.maxX | 0) + ',' + (bounds.minY | 0) + ',' + (bounds.maxY | 0) +
      '/' + size + '/' + fp;
    if (_reachCacheKey === cacheKey && _reachCacheCells) return _reachCacheCells;

    function occupies(x, y) {
      var i;
      for (i = 0; i < (allUnits || []).length; i++) {
        u = allUnits[i];
        if (!u || (u.hp | 0) <= 0 || u === actor) continue;
        if (checkOverlap(x, y, size, u.x | 0, u.y | 0, unitSize(u))) return true;
      }
      return false;
    }

    function enemyBlocks(x, y) {
      var i;
      for (i = 0; i < (allUnits || []).length; i++) {
        u = allUnits[i];
        if (!u || (u.hp | 0) <= 0 || u === actor) continue;
        if (u.side === actor.side) continue;
        if (checkOverlap(x, y, size, u.x | 0, u.y | 0, unitSize(u))) return true;
      }
      return false;
    }

    while (head < queue.length) {
      curr = queue[head++];
      isOcc = occupies(curr.x, curr.y);
      if (!isOcc) reachable.push(curr);
      if (curr.cost >= move) continue;
      dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (t = 0; t < 4; t++) {
        nx = curr.x + dirs[t][0];
        ny = curr.y + dirs[t][1];
        if (nx < bounds.minX || nx + size - 1 > bounds.maxX) continue;
        if (ny < bounds.minY || ny + size - 1 > bounds.maxY) continue;
        key = nx + ',' + ny;
        if (visited[key]) continue;
        if (enemyBlocks(nx, ny)) continue;
        visited[key] = 1;
        queue.push({ x: nx, y: ny, cost: curr.cost + 1, parent: curr });
      }
    }
    if (!reachable.length) reachable.push({ x: startX, y: startY, cost: 0 });
    _reachCacheKey = cacheKey;
    _reachCacheCells = reachable;
    return reachable;
  }

  /** Rebuild step list from BFS parent chain (excluding start). */
  function pathFromNode(node) {
    var path = [];
    var p = node;
    while (p && p.parent) {
      path.push({ x: p.x, y: p.y });
      p = p.parent;
    }
    path.reverse();
    return path;
  }

  /**
   * gge getBestMoveDestination — cell within weapon minR..maxR of target,
   * fewest steps, then closest Euclidean center (encircle tie-break).
   */
  function getBestMoveDestination(actor, target, maxMove, minR, maxR, allUnits, bounds) {
    var size = unitSize(actor);
    var start = { x: actor.x | 0, y: actor.y | 0 };
    var startDist = distance({ x: start.x, y: start.y, size: size }, target);
    var reachable, bestCell, bestScore, bestSteps, i, cell, d, score, tSize, tCx, tCy, aCx, aCy, bCx, bCy, eA, eB;

    if (startDist >= minR && startDist <= maxR) {
      return { x: start.x, y: start.y, path: [], moved: false };
    }

    reachable = getReachableCells(actor, maxMove, allUnits, bounds);
    bestCell = start;
    bestScore = Infinity;
    bestSteps = Infinity;
    tSize = unitSize(target);
    tCx = (target.x | 0) + (tSize - 1) / 2;
    tCy = (target.y | 0) + (tSize - 1) / 2;

    for (i = 0; i < reachable.length; i++) {
      cell = reachable[i];
      d = distance({ x: cell.x, y: cell.y, size: size }, target);
      if (d >= minR && d <= maxR) score = 0;
      else if (d < minR) score = minR - d;
      else score = d - maxR;

      if (score < bestScore) {
        bestScore = score;
        bestSteps = cell.cost | 0;
        bestCell = cell;
      } else if (score === bestScore) {
        if ((cell.cost | 0) < bestSteps) {
          bestSteps = cell.cost | 0;
          bestCell = cell;
        } else if ((cell.cost | 0) === bestSteps) {
          aCx = bestCell.x + (size - 1) / 2;
          aCy = bestCell.y + (size - 1) / 2;
          bCx = cell.x + (size - 1) / 2;
          bCy = cell.y + (size - 1) / 2;
          eA = Math.pow(aCx - tCx, 2) + Math.pow(aCy - tCy, 2);
          eB = Math.pow(bCx - tCx, 2) + Math.pow(bCy - tCy, 2);
          if (eB < eA) bestCell = cell;
        }
      }
    }

    return {
      x: bestCell.x,
      y: bestCell.y,
      path: pathFromNode(bestCell),
      moved: bestCell.x !== start.x || bestCell.y !== start.y
    };
  }

  /**
   * gge achievableTargets: enemies you can put in some weapon's range after moving.
   * Then pick lowest current HP; weapon = highest preview damage among those that reach.
   */
  function pickEngage(attacker, enemies, allUnits, bounds, damageOf) {
    var move = Math.max(0, attacker.move | 0);
    var cells = getReachableCells(attacker, move, allUnits, bounds);
    var achievable = [];
    var e, w, bestWpn, bestDmg, can, ideal, i, cell, d, baseDist, mn, mx, pDmg;

    alive(enemies).forEach(function (enemy) {
      bestWpn = null;
      bestDmg = -1;
      baseDist = distance(attacker, enemy);
      (attacker.weapons || []).forEach(function (weapon) {
        if (isMapWeapon(weapon)) return;
        mn = weapon.min_range != null ? weapon.min_range | 0 : 1;
        mx = weapon.max_range != null ? weapon.max_range | 0 : mn;
        can = false;
        ideal = Infinity;
        for (i = 0; i < cells.length; i++) {
          cell = cells[i];
          d = distance({ x: cell.x, y: cell.y, size: unitSize(attacker) }, enemy);
          if (d >= mn && d <= mx) {
            can = true;
            if (d < ideal) ideal = d;
          }
        }
        if (!can) return;
        if (baseDist >= mn && baseDist <= mx) ideal = baseDist;
        pDmg = typeof damageOf === 'function'
          ? Math.max(0, damageOf(attacker, enemy, weapon) | 0)
          : (weapon.power | 0);
        if (pDmg > bestDmg) {
          bestDmg = pDmg;
          bestWpn = weapon;
        }
      });
      if (bestWpn) achievable.push({ enemy: enemy, weapon: bestWpn, expectedDmg: bestDmg });
    });

    if (!achievable.length) return null;
    achievable.sort(function (a, b) {
      if ((a.enemy.hp | 0) !== (b.enemy.hp | 0)) return (a.enemy.hp | 0) - (b.enemy.hp | 0);
      return (a.enemy.n | 0) - (b.enemy.n | 0);
    });
    e = achievable[0];
    mn = e.weapon.min_range != null ? e.weapon.min_range | 0 : 1;
    mx = e.weapon.max_range != null ? e.weapon.max_range | 0 : mn;
    return { target: e.enemy, weapon: e.weapon, minR: mn, maxR: mx, expectedDmg: e.expectedDmg };
  }

  function pickTarget(attacker, enemies) {
    var best = null;
    alive(enemies).forEach(function (e) {
      if (!weaponsInRange(attacker, e).length) return;
      if (!best || (e.hp | 0) < (best.hp | 0) || ((e.hp | 0) === (best.hp | 0) && (e.n | 0) < (best.n | 0))) {
        best = e;
      }
    });
    return best;
  }

  function nearestEnemy(attacker, enemies) {
    var best = null;
    var bestD = 1e9;
    var d;
    alive(enemies).forEach(function (e) {
      d = distance(attacker, e);
      if (d < bestD || (d === bestD && (e.hp | 0) < (best.hp | 0))) {
        best = e;
        bestD = d;
      }
    });
    return best;
  }

  function pickWeapon(attacker, defender, damageOf) {
    var ranked = rankWeaponsByDamage(
      attacker,
      defender,
      weaponsInRange(attacker, defender),
      damageOf
    );
    if (!ranked.length) return null;
    return {
      weapon: ranked[0].weapon,
      damage: ranked[0].calFailed ? ranked[0].power : ranked[0].dmg
    };
  }

  function detailTexts(ability) {
    var out = [];
    var details = ability && ability.details;
    var i, d;
    if (!details) {
      if (ability && (ability.effect || ability.description || ability.desc)) {
        out.push(String(ability.effect || ability.description || ability.desc));
      }
      return out;
    }
    if (typeof details === 'string') return [details];
    if (!Array.isArray(details)) return out;
    for (i = 0; i < details.length; i++) {
      d = details[i];
      if (typeof d === 'string') out.push(d);
      else if (d && d.text) out.push(String(d.text));
    }
    return out;
  }

  /**
   * gge isAbilityActive-lite for one detail row: empty conditions always on;
   * unit id / tags / role / series must match the actor's unit (and pilot tags).
   */
  function detailConditionsMet(actor, detail) {
    var conds = [];
    var i, g, c, id, typ, src, name, role, unitTags, charTags, series, ok;
    if (!detail || typeof detail !== 'object') return true;
    if (Array.isArray(detail.conditions)) {
      for (i = 0; i < detail.conditions.length; i++) conds.push(detail.conditions[i]);
    }
    if (!conds.length && Array.isArray(detail.condition_groups)) {
      for (i = 0; i < detail.condition_groups.length; i++) {
        g = detail.condition_groups[i];
        if (g && Array.isArray(g.conditions)) {
          g.conditions.forEach(function (x) { conds.push(x); });
        }
      }
    }
    if (!conds.length) return true;
    role = String((actor && actor.unit && (actor.unit.role || actor.unit.type)) || '').toLowerCase();
    unitTags = [];
    charTags = [];
    series = [];
    if (actor && actor.unit) {
      (actor.unit.tags || []).forEach(function (t) {
        unitTags.push(String(t && t.name != null ? t.name : t).toLowerCase());
        if (t && t.id != null) unitTags.push(String(t.id));
      });
      (actor.unit.series || []).forEach(function (t) {
        series.push(String(t && t.name != null ? t.name : t).toLowerCase());
        if (t && t.id != null) series.push(String(t.id));
      });
    }
    if (actor && actor.char) {
      (actor.char.tags || []).forEach(function (t) {
        charTags.push(String(t && t.name != null ? t.name : t).toLowerCase());
        if (t && t.id != null) charTags.push(String(t.id));
      });
    }
    function oneCond(cond) {
      if (!cond) return true;
      id = String(cond.id || '').trim();
      typ = String(cond.type || '').toLowerCase();
      src = String(cond.source || '').toLowerCase();
      name = String(cond.name || '').toLowerCase();
      /* unit_tags / “piloting unit with tags” — unit only (never pilot char tags). */
      if (src === 'unit_tags' || src === 'unit_ids' || typ === 'unit' || (typ.indexOf('unit') >= 0 && src.indexOf('char') < 0)) {
        if (src === 'unit_ids' || /^\d{8,}$/.test(id)) {
          if (id && actor && actor.unit && String(actor.unit.id) === id) return true;
          if (name && actor && actor.unit && String(actor.unit.name || '').toLowerCase() === name) return true;
          return false;
        }
        if (id && actor && actor.unit && String(actor.unit.id) === id) return true;
        if (name && unitTags.indexOf(name) >= 0) return true;
        if (id && unitTags.indexOf(id) >= 0) return true;
        if (name && series.indexOf(name) >= 0) return true;
        if (id && series.indexOf(id) >= 0) return true;
        return false;
      }
      if (src === 'character_tags' || src.indexOf('char') >= 0 || typ.indexOf('char') >= 0) {
        if (name && charTags.indexOf(name) >= 0) return true;
        if (id && charTags.indexOf(id) >= 0) return true;
        return false;
      }
      if (typ === 'unit_role' || typ === 'role' || /role|type/.test(typ) || /role|type/.test(src)) {
        if (/durability|defense|耐久/.test(name) || /role_2|defense/.test(id)) {
          return /durability|defense|耐久/.test(role);
        }
        if (/support|支援/.test(name) || /role_3|support/.test(id)) {
          return /support|支援/.test(role);
        }
        if (/attack|攻撃|攻擊/.test(name) || /role_1|attack/.test(id)) {
          return /attack|攻撃|攻擊/.test(role);
        }
        return !name || role.indexOf(name) >= 0;
      }
      /* Unknown condition types: do not zero out an explicit +N count line. */
      return true;
    }
    /* condition_groups are OR across groups, AND within — if we flattened all
       conditions from multiple groups we AND them. Prefer group OR when present. */
    if (Array.isArray(detail.condition_groups) && detail.condition_groups.length) {
      ok = detail.condition_groups.some(function (grp) {
        var list = (grp && grp.conditions) || [];
        if (!list.length) return true;
        return list.every(oneCond);
      });
      return ok;
    }
    return conds.every(oneCond);
  }

  function iterAbilityDetails(actor, fn) {
    var bags = [];
    var i, j, ab, details, d, text;
    if (actor && actor.char && actor.char.abilities) bags.push(actor.char.abilities);
    if (actor && actor.unit && actor.unit.abilities) bags.push(actor.unit.abilities);
    bags.forEach(function (list) {
      for (i = 0; i < list.length; i++) {
        ab = list[i];
        details = ab && ab.details;
        if (!details) {
          text = ab && (ab.effect || ab.description || ab.desc || ab.name);
          if (text) fn(ab, null, String(text));
          continue;
        }
        if (typeof details === 'string') {
          fn(ab, null, details);
          continue;
        }
        if (!Array.isArray(details)) continue;
        for (j = 0; j < details.length; j++) {
          d = details[j];
          if (typeof d === 'string') fn(ab, null, d);
          else if (d && d.text) fn(ab, d, String(d.text));
        }
      }
    });
  }

  /**
   * gge calcSupportDefendLimit — SUM every active 「支援防御」+N line (per turn stock).
   * Once-per-battle lines subtract battleSupportDefendedCount. Tension / detail
   * conditions are evaluated live (not the dossier conditionalPassiveActive toggle).
   */
  function supportDefendLimit(actor) {
    var count = 0;
    var usedBattle = (actor && actor.battleSupportDefendedCount) | 0;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var norm, m, addVal, once;
      if (detail && !detailConditionsMet(actor, detail)) return;
      norm = normalizeFullwidth(text);
      m = norm.match(/Support\s*Defense(?:」|】|\")?\s*\+\s*(\d+)\s*times?/i)
        || norm.match(/「?支援防御」?\s*\+\s*(\d+)\s*回/i)
        || norm.match(/「?支援防禦」?\s*\+\s*(\d+)\s*次/i)
        || norm.match(/'지원\s*방어'\s*\+\s*(\d+)/i);
      if (!m) return;
      if (!tensionOk(actor && actor.mp, norm)) return;
      addVal = parseInt(m[1], 10) || 0;
      /* Require explicit once-per-battle wording — NOT plain "+1 time(s)". */
      once = /(?:1\s*(?:time|battle)\s*only|once\s*per\s*battle|only\s*once\s*per\s*battle|1回のみ発動|1バトルに1回|每場戰鬥僅?1次)/i.test(norm);
      if (once) {
        if (usedBattle < addVal) count += (addVal - usedBattle);
      } else {
        count += addVal;
      }
    });
    return count;
  }

  function supportDefendRangeBonus(actor) {
    var bonus = 0;
    var list = (actor && actor.char && actor.char.abilities) || [];
    var i, ab, texts, j, norm, m;
    for (i = 0; i < list.length; i++) {
      ab = list[i];
      texts = detailTexts(ab);
      for (j = 0; j < texts.length; j++) {
        norm = String(texts[j])
          .replace(/[０-９]/g, function (s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0); });
        /* gge getGuardSupportDefendBonus — 「支援防御の範囲がN上昇」 etc. */
        if (!/Support\s*Defense.*range|支援防御.*範囲|支援防禦.*範圍|支援防御の範囲が/i.test(norm)) continue;
        m = norm.match(/(?:range|範囲|範圍)[^\d]*(\d+)|(\d+)\s*(?:上昇|up)/i) || norm.match(/(\d+)/);
        bonus += m ? (parseInt(m[1] || m[2], 10) || 1) : 1;
      }
    }
    return bonus;
  }

  /**
   * Live ability sum is authoritative. Cached sdLimit/saLimit is only a fallback when
   * char/unit ability payloads are missing (tests / partial loads).
   */
  function effectiveSupportDefendLimit(actor) {
    var live = supportDefendLimit(actor) | 0;
    if (live > 0) return live;
    return (actor && actor.sdLimit) | 0;
  }

  function effectiveSupportAttackLimit(actor) {
    var live = supportAttackLimit(actor) | 0;
    if (live > 0) return live;
    return (actor && actor.saLimit) | 0;
  }

  /** Remaining SD uses this turn (gge: calcSupportDefendLimit - usedSupportDefendCount). */
  function supportDefendRemaining(actor) {
    return Math.max(0, effectiveSupportDefendLimit(actor) - ((actor && actor.usedSupportDefendCount) | 0));
  }

  /** Remaining SA / support-counter uses this turn. */
  function supportAttackRemaining(actor) {
    return Math.max(0, effectiveSupportAttackLimit(actor) - ((actor && actor.usedSupportCount) | 0));
  }

  /**
   * LANG Terrain Capability row level: 3 ● · 2 ▲ · 1 -.
   * Season "Land" uses Ground/Land + Atmospheric (gge getTerrainSuitability for 地上).
   */
  function terrainRowLevel(unitData, aliases) {
    var rows = (unitData && unitData.terrain) || [];
    var best = 0;
    var i, row, name, lv, sym;
    var want = aliases || [];
    for (i = 0; i < rows.length; i++) {
      row = rows[i];
      if (!row) continue;
      name = String(row.name || '');
      if (want.indexOf(name) < 0) continue;
      lv = row.level != null ? (row.level | 0) : 0;
      if (!lv) {
        sym = String(row.symbol || row.mark || '');
        if (sym.indexOf('●') >= 0 || sym.indexOf('◯') >= 0) lv = 3;
        else if (sym.indexOf('▲') >= 0 || sym.indexOf('△') >= 0) lv = 2;
        else if (sym === '-') lv = 1;
      }
      if (lv > best) best = lv;
    }
    return best;
  }

  function fieldIsSpace(field) {
    return /space|宇宙|太空|우주/i.test(String(field || ''));
  }

  /**
   * Where the ally sits on a Land/Ground season without per-cell terrain:
   * Ground/Land ≥ ▲ → land tile; else Atmospheric ≥ ▲ → air. LANG SD requires
   * the guard to be able to move into that space (Terrain Capabilities).
   */
  function unitOccupancyMode(unitData, field) {
    var g, a;
    if (fieldIsSpace(field)) {
      return terrainRowLevel(unitData, ['Space', '宇宙', '太空', '우주']) >= 2 ? 'space' : 'none';
    }
    g = terrainRowLevel(unitData, ['Ground', 'Land', '地上', '地面', '지상']);
    a = terrainRowLevel(unitData, ['Atmospheric', '空中', '大氣', '大气', '공중']);
    if (g >= 2) return 'land';
    if (a >= 2) return 'air';
    return 'none';
  }

  function canEnterOccupancy(unitData, mode, field) {
    if (mode === 'space' || fieldIsSpace(field)) {
      return terrainRowLevel(unitData, ['Space', '宇宙', '太空', '우주']) >= 2;
    }
    if (mode === 'land') return terrainRowLevel(unitData, ['Ground', 'Land', '地上', '地面', '지상']) >= 2;
    if (mode === 'air') return terrainRowLevel(unitData, ['Atmospheric', '空中', '大氣', '大气', '공중']) >= 2;
    return false;
  }

  /** EN help: Units unable to move into the ally's space (Terrain Capabilities) cannot SD. */
  function canSupportDefendOnTarget(guard, target) {
    var field, mode;
    if (!guard || !target) return false;
    field = String(guard.fieldTerrain || target.fieldTerrain || '');
    mode = unitOccupancyMode(target.unit, field);
    if (mode === 'none') return false;
    return canEnterOccupancy(guard.unit, mode, field);
  }

  /**
   * gge guardCands: not self, remaining SD uses, Manhattan dist <= move + SD range bonus,
   * terrain-enterable cover cell (LANG), highest HP. Returns null if nobody covers.
   */
  function pickSupportDefender(target, allies) {
    var best = null;
    var maxHp = -1;
    if (!target) return null;
    alive(allies).forEach(function (a) {
      var limit, used, range;
      if (!a || a === target) return;
      limit = effectiveSupportDefendLimit(a);
      used = a.usedSupportDefendCount | 0;
      if (limit - used <= 0) return;
      if (!canSupportDefendOnTarget(a, target)) return;
      range = (a.move | 0) + (a.sdRangeBonus != null ? (a.sdRangeBonus | 0) : supportDefendRangeBonus(a));
      if (distance(a, target) > range) return;
      if ((a.hp | 0) > maxHp) {
        maxHp = a.hp | 0;
        best = a;
      }
    });
    return best;
  }

  function pickSupportAttacker(attacker, allies, defender, range) {
    var r = range == null ? 1 : range | 0;
    var best = null;
    var bestKey = -1;
    alive(allies).forEach(function (a) {
      var key;
      if (!a || a === attacker) return;
      if (distance(a, defender) > r) return;
      if (!weaponsInRange(a, defender, true).length) return;
      key = (a.mobility | 0) + (a.reaction | 0);
      if (!best || key > bestKey || (key === bestKey && (a.n | 0) < (best.n | 0))) {
        best = a;
        bestKey = key;
      }
    });
    return best;
  }

  function skillKeyFromName(name) {
    var n = String(name || '');
    if (/High\s*Speed|ハイスピード|高速/i.test(n)) return 'high_speed';
    /* EN ships both “Range Boost” and “Boost Range”. */
    if (/Range\s*Boost|Boost\s*Range|レンジブースト|射程/i.test(n)) return 'range_boost';
    if (/HP\s*Repair|リペア|修理|Repair/i.test(n)) return 'repair';
    if (/Force\s*Guard|フォースガード/i.test(n)) return 'force_guard';
    if (/MP\s*Up|MPアップ/i.test(n)) return 'mp_up';
    if (/Attack\s*Burst|アタックバースト/i.test(n)) return 'attack_burst';
    if (/Melee\s*Boost|格闘ブースト/i.test(n)) return 'melee_boost';
    /* EN: Shooting Boost / Ranged Boost */
    if (/Shooting\s*Boost|Ranged\s*Boost|射撃ブースト/i.test(n)) return 'shooting_boost';
    if (/Awaken\s*Boost|覚醒ブースト/i.test(n)) return 'awaken_boost';
    if (/Sway|スウェー/i.test(n)) return 'sway';
    if (/EN.*(?:Free|Ammo)|弾数フリー|EN・弾数/i.test(n)) return 'en_free';
    if (/Support\s*Defense.*\+|支援防御回数|支援時防御/i.test(n)) return 'sd_plus';
    if (/Critical\s*Boost|クリティカルブースト|爆擊提升/i.test(n)) return 'crit_boost';
    return '';
  }

  function buildPilotSkillKit(charData) {
    var list = [];
    var spMax = 0;
    ((charData && charData.skills) || []).forEach(function (s) {
      var key = skillKeyFromName(s && s.name);
      var cost = s && s.sp != null ? (s.sp | 0) : 0;
      if (!key) return;
      list.push({
        key: key,
        name: s.name || key,
        sp: cost,
        icon: (s && (s.icon || s.icon_url || s.thum)) || '',
        effect: Array.isArray(s.details) ? s.details.join(' ') : String(s.details || s.effect || '')
      });
      if (cost > spMax) spMax = cost;
    });
    return { list: list, sp: Math.max(spMax, 5) };
  }

  /** gge / site: Chance Step uses (額外行動). Base 1; +1 ability → up to 2. */
  function chanceStepLimit(actor) {
    var n = 1;
    var bags = [];
    var i, ab, texts, j, t;
    if (typeof globalThis !== 'undefined' && typeof globalThis.getCharacterChanceSupportState === 'function' && actor && actor.char) {
      try {
        return Math.max(1, Math.min(2, globalThis.getCharacterChanceSupportState(actor.char).chanceCount | 0));
      } catch (e) {}
    }
    if (actor && actor.char && actor.char.abilities) bags.push(actor.char.abilities);
    bags.forEach(function (list) {
      for (i = 0; i < list.length; i++) {
        ab = list[i];
        texts = detailTexts(ab);
        for (j = 0; j < texts.length; j++) {
          t = texts[j];
          if (/Chance\s*Step|チャンスステップ|額外行動|찬스 스텝/i.test(t) && /[+＋]\s*1|×\s*2|x2/i.test(t)) {
            n = 2;
          }
        }
      }
    });
    return n;
  }

  /** gge predictCounter — an enemy can still hit us after we close. */
  function enemyCanCounter(unit, enemies) {
    return alive(enemies).some(function (e) {
      var dist, move, maxR, reach;
      if (weaponsInRange(e, unit).length) return true;
      dist = distance(unit, e);
      move = e.move | 0;
      maxR = 1;
      (e.weapons || []).forEach(function (w) {
        if ((w.max_range | 0) > maxR) maxR = w.max_range | 0;
      });
      reach = Math.max(1, dist - (unit.move | 0));
      return reach <= maxR && (dist + move) >= 1;
    });
  }

  /**
   * gge evaluatePilotSkills priority:
   * High Speed, Range Boost, Repair, Force Guard, MP Up, bursts,
   * EN free, SD-count, Sway (only if a counter is possible), Crit Boost.
   */
  function pickSkill(unit, enemies) {
    var kit, i, sk, canHit, maxHp, hp, sp, order, oi, key;
    if (!unit || unit.skillUsed || unit.usedSkillThisTurn) return null;
    kit = unit.pilotSkills || { list: [] };
    sp = unit.currentSp != null ? (unit.currentSp | 0) : (unit.sp | 0);
    canHit = alive(enemies).some(function (e) { return weaponsInRange(unit, e).length > 0; });
    maxHp = unit.maxHp | 0;
    hp = unit.hp | 0;

    function find(k) {
      for (i = 0; i < (kit.list || []).length; i++) {
        if (kit.list[i].key === k) return kit.list[i];
      }
      return null;
    }
    function afford(s) { return s && sp >= (s.sp | 0); }

    order = [
      'high_speed', 'range_boost', 'repair', 'force_guard', 'mp_up',
      'attack_burst', 'shooting_boost', 'melee_boost', 'awaken_boost',
      'en_free', 'sd_plus', 'sway', 'crit_boost'
    ];
    for (oi = 0; oi < order.length; oi++) {
      key = order[oi];
      sk = find(key);
      if (!afford(sk)) continue;
      if ((key === 'high_speed' || key === 'range_boost') && canHit) continue;
      if (key === 'repair' && !(maxHp > 0 && hp * 2 < maxHp)) continue;
      if (key === 'mp_up' && !((unit.mp | 0) >= 2 && (unit.mp | 0) < 12)) continue;
      if (key === 'en_free' && unit.hasUsedFreeAmmoSkillInBattle) continue;
      if (key === 'sway' && !enemyCanCounter(unit, enemies)) continue;
      return sk;
    }
    return null;
  }

  function unitSkillText(sk) {
    var parts = [];
    if (!sk) return '';
    if (sk.name) parts.push(String(sk.name));
    if (sk.effect) parts.push(String(sk.effect));
    (sk.details || []).forEach(function (d) {
      parts.push(typeof d === 'string' ? d : ((d && d.text) || ''));
    });
    (sk.traits || []).forEach(function (tr) {
      if (!tr) return;
      if (tr.desc) parts.push(String(tr.desc));
      if (tr.name) parts.push(String(tr.name));
      parts.push('type:' + String(tr.trait_type_index || '') + ':' + String(tr.trait_value || ''));
    });
    return parts.join(' ');
  }

  /**
   * gge evaluateUnitSkill timing:
   * first-strike / initial-null skills fire at combat start;
   * every other unit skill fires once before the move.
   * Numbers stay in /cal — this only decides when the skill turns on.
   */
  function planUnitSkill(actor, phase) {
    var skills, i, sk, blob, anyFirst, first, out, m;
    if (!actor || actor.hasUsedUnitSkill || !actor.unit) return null;
    skills = actor.unit.skills || actor.unit.unit_skills || [];
    if (!skills.length) return null;
    anyFirst = skills.some(function (s) {
      var t = unitSkillText(s);
      return /Initial\s+Damage\s+Nullification|初撃|初回ダメージ無効|type:8:/i.test(t);
    });
    if (anyFirst && phase !== 'combat') return null;
    if (!anyFirst && phase === 'combat') return null;
    out = {
      name: '',
      icon: '',
      atkPct: 0,
      defPct: 0,
      mobPct: 0,
      mp: 0,
      move: 0,
      barrierPct: 0,
      firstStrike: false,
      beamDr: 0
    };
    for (i = 0; i < skills.length; i++) {
      sk = skills[i];
      blob = unitSkillText(sk);
      first = /Initial\s+Damage\s+Nullification|初撃|初回ダメージ無効|type:8:/i.test(blob);
      if (!out.name && sk.name) out.name = String(sk.name);
      if (!out.icon) out.icon = sk.icon || sk.icon_url || sk.thum || '';
      (sk.traits || []).forEach(function (tr) {
        var typ = String(tr && tr.trait_type_index || '');
        var val = Math.max(0, parseInt(tr && tr.trait_value, 10) || 0);
        if (typ === '2') out.atkPct = Math.max(out.atkPct, val);
        if (typ === '3') out.defPct = Math.max(out.defPct, val);
        if (typ === '6') out.barrierPct = Math.max(out.barrierPct, val);
        if (typ === '7') out.mobPct = Math.max(out.mobPct, val);
        if (typ === '8') out.firstStrike = true;
        if (typ === '11' && /beam|ビーム|光束|鐳射/i.test(blob)) out.beamDr = Math.max(out.beamDr, val);
      });
      if (first) out.firstStrike = true;
      m = blob.match(/攻撃力[^%]{0,12}(\d+)\s*%|Attack[^%]{0,16}(\d+)\s*%/i);
      if (m) out.atkPct = Math.max(out.atkPct, parseInt(m[1] || m[2], 10) || 0);
      m = blob.match(/防御力[^%]{0,12}(\d+)\s*%|Defense[^%]{0,16}(\d+)\s*%/i);
      if (m) out.defPct = Math.max(out.defPct, parseInt(m[1] || m[2], 10) || 0);
      m = blob.match(/機動力[^%]{0,12}(\d+)\s*%|Mobility[^%]{0,16}(\d+)\s*%/i);
      if (m) out.mobPct = Math.max(out.mobPct, parseInt(m[1] || m[2], 10) || 0);
      m = blob.match(/MP(?:が|を)?\s*(\d+)\s*上昇|Increase\s+(?:own\s+)?MP\s+by\s+(\d+)/i);
      if (m) out.mp = Math.max(out.mp, parseInt(m[1] || m[2], 10) || 0);
      m = blob.match(/移動力[^0-9]{0,8}(\d+)|Move\s*\+\s*(\d+)/i);
      if (m) out.move = Math.max(out.move, parseInt(m[1] || m[2], 10) || 0);
      m = blob.match(/最大HP\s*(\d+)\s*%|Max\s*HP[^0-9]{0,12}(\d+)\s*%/i);
      if (m && /バリア|barrier|屏障/i.test(blob)) {
        out.barrierPct = Math.max(out.barrierPct, parseInt(m[1] || m[2], 10) || 0);
      }
      m = blob.match(/ビーム[^%]{0,16}(\d+)\s*%|beam[^%]{0,24}(\d+)\s*%/i);
      if (m && /軽減|reduce\s+damage/i.test(blob)) {
        out.beamDr = Math.max(out.beamDr, parseInt(m[1] || m[2], 10) || 0);
      }
    }
    if (!(out.atkPct || out.defPct || out.mobPct || out.mp || out.move || out.barrierPct || out.firstStrike || out.beamDr)) {
      return null;
    }
    return out;
  }

  function rankedPoints(role, win, turns, upset) {
    var pts = 0;
    if (win) {
      if (turns <= 1) pts = 15;
      else if (turns === 2) pts = 8;
      else if (turns === 3) pts = 4;
      else if (turns === 4) pts = 2;
      else if (turns === 5 && role === 'attack') pts = 1;
    } else if (role === 'attack') {
      if (turns <= 1) pts = -20;
      else if (turns === 2) pts = -14;
      else if (turns <= 4) pts = -10;
    } else if (role === 'defense') {
      if (turns <= 1) pts = -15;
      else if (turns === 2) pts = -10;
      else if (turns <= 4) pts = -5;
    }
    if (upset && pts > 0) pts *= 2;
    if (upset && pts < 0) pts = Math.ceil(pts / 2);
    return pts;
  }

  /* ========== gge battle-loop combat systems (executeAttack / runSimulation) ========== */

  function abilityTextBags(actor) {
    var bags = [];
    var out = [];
    var i, j, ab, texts;
    if (actor && actor.char && actor.char.abilities) bags.push(actor.char.abilities);
    if (actor && actor.unit && actor.unit.abilities) bags.push(actor.unit.abilities);
    bags.forEach(function (list) {
      for (i = 0; i < list.length; i++) {
        ab = list[i];
        texts = detailTexts(ab);
        if (!texts.length && ab && ab.name) texts = [String(ab.name)];
        for (j = 0; j < texts.length; j++) out.push({ ab: ab, text: texts[j] });
      }
    });
    return out;
  }

  function normalizeFullwidth(s) {
    return String(s || '')
      .replace(/[０-９Ａ-Ｚａ-ｚ]/g, function (c) {
        return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
      })
      .replace(/％/g, '%')
      .replace(/＋/g, '+');
  }

  function tensionOk(mp, text) {
    var t = normalizeFullwidth(text);
    var m = mp | 0;
    if (/超一撃|Supercharged\s*EX|超一擊/i.test(t) && m < 12) return false;
    /* "Max or greater" / 超強気以上 — require High band (MP≥8), before soft High|Max matcher. */
    if (/(?:Vigor\s+is\s+[\"'「]?Max|Vigor[^\n]{0,24}Max[\"'」]?\s+or\s+greater|テンションが「?超強気|テンション「?超強気」?以上|戰意為「?超強勢|戰意「?超強勢」?以上|战意为「?超强势)/i.test(t) && m < 8) return false;
    if (/超強気|High\s*Vigor|超強勢/i.test(t) && !/超一撃|Supercharged/i.test(t) && m < 8) return false;
    if (/強気以上|Vigor.*(High|Max)|強勢以上/i.test(t) && m < 4) return false;
    return true;
  }

  function weaponIsSpecial(weapon) {
    var t = String((weapon && weapon.raw && weapon.raw.weapon_type) || (weapon && weapon.weapon_type) || '');
    if (/特殊|special/i.test(t)) return true;
    /* Numeric type tables sometimes encode special as 3 / "Special". */
    if (/^3$/.test(t.trim())) return true;
    return false;
  }

  /**
   * gge calcSupportLimit — SUM every active Support Attack/Counter +N line.
   * Do NOT use bare「支援」+N (that false-matches 支援防御). Do NOT cache via saLimit
   * (tension-gated EX +N must re-evaluate as MP rises).
   */
  function supportAttackLimit(actor) {
    var count = 0;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var norm, m;
      if (detail && !detailConditionsMet(actor, detail)) return;
      norm = normalizeFullwidth(text);
      /* EN */
      m = norm.match(/Support\s+Attack\s*\/\s*(?:Support\s*)?Counter\s*\+\s*(\d+)\s*times?/i)
        || norm.match(/Support\s+Attack(?!\s*\/)\s*\+\s*(\d+)\s*times?/i)
        /* JA — require 攻撃/反撃, never bare 支援 (avoids 支援防御) */
        || norm.match(/「?支援攻撃\s*[\/／・]\s*(?:支援)?反撃」?\s*\+\s*(\d+)\s*回?/i)
        || norm.match(/「?支援攻撃」?\s*\+\s*(\d+)\s*回?/i)
        || norm.match(/「?支援反撃」?\s*\+\s*(\d+)\s*回?/i)
        /* TW/HK */
        || norm.match(/「?支援攻擊\s*[\/／・]\s*(?:支援)?反擊」?\s*\+\s*(\d+)\s*次?/i)
        || norm.match(/「?支援攻擊」?\s*\+\s*(\d+)\s*次?/i)
        || norm.match(/「?支援反擊」?\s*\+\s*(\d+)\s*次?/i)
        /* KR */
        || norm.match(/'지원\s*공격\s*[\/／]\s*반격'\s*\+\s*(\d+)/i);
      if (!m) return;
      if (!tensionOk(actor && actor.mp, norm)) return;
      count += parseInt(m[1], 10) || 0;
    });
    return count;
  }

  /** gge checkCounterSupportDefend — ability must explicitly allow SD vs counter. */
  function canCounterSupportDefend(actor) {
    var found = false;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var t;
      if (found) return;
      if (detail && !detailConditionsMet(actor, detail)) return;
      t = normalizeFullwidth(text);
      if (!/反撃に対して支援防御|反撃時支援防御|Counter.*Support\s*Defense|Support\s*Defense.*[Cc]ounter|支援防御.*反撃|支援防禦.*反擊/i.test(t)) return;
      if (!tensionOk(actor && actor.mp, t)) return;
      found = true;
    });
    return found;
  }

  function pickCounterSupportDefender(actor, friends) {
    var best = null;
    var maxHp = -1;
    if (!actor) return null;
    alive(friends).forEach(function (a) {
      var limit, used, range;
      if (!a || a === actor) return;
      if (!canCounterSupportDefend(a)) return;
      if (!canSupportDefendOnTarget(a, actor)) return;
      limit = effectiveSupportDefendLimit(a);
      used = a.usedSupportDefendCount | 0;
      if (limit - used <= 0) return;
      range = (a.move | 0) + (a.sdRangeBonus != null ? (a.sdRangeBonus | 0) : supportDefendRangeBonus(a));
      if (distance(a, actor) > range) return;
      if ((a.hp | 0) > maxHp) {
        maxHp = a.hp | 0;
        best = a;
      }
    });
    return best;
  }

  function hasShieldMechanism(actor) {
    var mech = '';
    if (!actor) return false;
    if (actor.unit) {
      if (Array.isArray(actor.unit.mechanisms)) mech = actor.unit.mechanisms.join(' ');
      else mech = String(actor.unit.mechanism || actor.unit.mechanisms || '');
    }
    return /shield|シールド|護盾|防盾/i.test(mech);
  }

  /** gge determineDefenseAction */
  function determineDefenseAction(defender, expectedDmg, hasCounter, hasPreemptiveCounter) {
    var cut;
    if (hasPreemptiveCounter) return 'none';
    if (hasCounter && (defender.hp | 0) > (expectedDmg | 0)) return 'none';
    cut = hasShieldMechanism(defender) ? 0.6 : 0.8;
    if ((defender.hp | 0) > Math.floor((expectedDmg | 0) * cut)) {
      return hasShieldMechanism(defender) ? 'shield' : 'defend';
    }
    return 'evade';
  }

  function isPreemptiveWeapon(actor, weapon) {
    var blob, wpnType;
    if (!weapon) return false;
    if (weapon.is_preemptive || (weapon.raw && weapon.raw.is_preemptive)) return true;
    blob = weaponEffectBlob(weapon);
    if (/先制攻撃|Preemptive\s*Strike|先發攻擊|先发攻击/i.test(blob)) return true;
    wpnType = String((weapon.raw && (weapon.raw.weapon_type || weapon.raw.attack_types)) || weapon.weapon_type || '');
    if (actor && actor.debuffs && actor.debuffs.some(function (d) {
      return d && d.type === '格闘武装先制' && d.isUp;
    }) && /格闘|melee|1/i.test(wpnType)) return true;
    return false;
  }

  function isAbsoluteHitWeapon(weapon) {
    return /絶対命中|Absolute\s*Hit|絕對命中|绝对命中|回避無効|Evasion\s*Invalid/i.test(weaponEffectBlob(weapon));
  }

  function weaponGrantsUnconditionalCsOnHit(weapon) {
    return /命中時にチャンスステップ|Chance\s*Step.*(on\s*hit|when\s*hit)|命中時.*額外行動|命中时.*额外行动/i.test(weaponEffectBlob(weapon));
  }

  function canUseFreeAmmoSkill(actor) {
    var skills, i, sk, cost, name;
    if (!actor) return false;
    if (actor.freeAmmoThisAction) return true;
    if (actor.activeSkills && actor.activeSkills.some(function (s) {
      return s && /EN[・･·\s]*Ammo\s*Free|EN・弾数フリー|EN[・･].*彈數|EN.*Ammo.*Free/i.test(String(s.name || ''));
    })) return true;
    if (actor.hasUsedFreeAmmoSkillInBattle || actor.usedSkillThisTurn) return false;
    skills = (actor.pilotSkills && actor.pilotSkills.list) || [];
    if (!skills.length && actor.char && actor.char.skills) {
      skills = actor.char.skills.map(function (s) {
        return { name: s.name, sp: s.sp };
      });
    }
    for (i = 0; i < skills.length; i++) {
      sk = skills[i];
      name = String(sk && sk.name || '');
      if (!/EN[・･·\s]*Ammo\s*Free|EN・弾数フリー|EN[・･].*彈數|EN.*Ammo.*Free/i.test(name)) continue;
      cost = sk.sp != null ? (sk.sp | 0) : 5;
      if ((actor.currentSp != null ? actor.currentSp : actor.sp) >= cost) return true;
    }
    return false;
  }

  function getEffectiveEnCost(actor, weapon, isSupport) {
    var base, mult, maxEn, curEn, ratio, bags, i, desc, m, saEnRed, abMax;
    if (!actor || !weapon) return 0;
    base = weapon.en != null ? (weapon.en | 0)
      : (weapon.en_cost != null ? (weapon.en_cost | 0)
        : (weapon.raw && (weapon.raw.en_cost != null ? weapon.raw.en_cost : weapon.raw.en)) | 0);
    if (base <= 0) return 0;
    mult = 1;
    maxEn = (actor.maxEn | 0) || 100;
    curEn = actor.currentEn != null ? (actor.currentEn | 0) : maxEn;
    ratio = maxEn > 0 ? (curEn / maxEn) * 100 : 100;
    bags = abilityTextBags(actor);
    for (i = 0; i < bags.length; i++) {
      desc = normalizeFullwidth(bags[i].text);
      m = desc.match(/EN(?:が)?(\d+)%以上|EN\s*(?:at\s*)?(?:or\s*)?(?:above\s*)?(\d+)%/i);
      if (m) {
        if (ratio < (parseInt(m[1] || m[2], 10) || 0)) continue;
      }
      m = desc.match(/消費EN(?:が)?(\d+)%増加|EN\s*cost\s*\+(\d+)%|EN\s*consumption.*?(\d+)%\s*increase/i);
      if (m) mult += (parseInt(m[1] || m[2] || m[3], 10) || 0) / 100;
      /* Always-on EN reduction (not SA-gated). SA/Counter EN cut is handled below with type gates. */
      if (!/Support\s+Attack|支援攻撃|支援攻擊|지원\s*공격/i.test(desc)) {
        m = desc.match(/消費EN(?:が)?(\d+)%(?:軽減|減少)|EN\s*cost\s*-(\d+)%|EN\s*consumption.*?(\d+)%\s*(?:reduc|decreas)/i);
        if (m) mult -= (parseInt(m[1] || m[2] || m[3], 10) || 0) / 100;
      }
    }
    /* Support Attack/Counter: “reduce own weapon EN consumption by N%” when type/tag conditions match. */
    if (isSupport) {
      saEnRed = 0;
      if (typeof root._dcParseMaxSupportCounterEnRedPctFromChar === 'function'
        && actor.char && actor.unit) {
        try {
          saEnRed = root._dcParseMaxSupportCounterEnRedPctFromChar(actor.char, actor.unit) | 0;
        } catch (eEn) { saEnRed = 0; }
      }
      if (saEnRed <= 0) {
        /* Fallback: scan ability details with role/tag gates (same as detailConditionsMet). */
        abMax = 0;
        iterAbilityDetails(actor, function (ab, detail, text) {
          var norm, p, mm;
          if (detail && !detailConditionsMet(actor, detail)) return;
          norm = normalizeFullwidth(text);
          if (!/Support\s+Attack\s*\/\s*(?:Support\s*)?Counter|Support\s+Attack\/Counter|支援攻撃|支援攻擊|지원\s*공격/i.test(norm)) return;
          mm = norm.match(/reduce\s+(?:own\s+)?(?:weapon\s+)?EN\s+consumption\s+by\s+(\d+)\s*%/i)
            || norm.match(/消費EN(?:が)?(\d+)%(?:軽減|減少)/)
            || norm.match(/消耗EN減輕(\d+)%/)
            || norm.match(/무장\s*소비\s*EN[이가]?\s*(\d+)\s*%\s*감소/i);
          if (!mm) return;
          p = parseInt(mm[1], 10) || 0;
          if (p > abMax) abMax = p;
        });
        saEnRed = abMax;
      }
      if (saEnRed > 0) mult -= saEnRed / 100;
    }
    if (actor.unit && actor.unit.pilot_en_cost_reduction_pct) {
      mult -= (actor.unit.pilot_en_cost_reduction_pct | 0) / 100;
    }
    return Math.max(0, Math.round(base * Math.max(0, mult)));
  }

  function weaponMpRequirement(weapon) {
    var blob = normalizeFullwidth(weaponEffectBlob(weapon) + ' ' + ((weapon.usage_restrictions || []).join(' ')));
    var req = 0;
    var m;
    if (/超一撃|Supercharged\s*EX|超一擊/i.test(blob)) req = Math.max(req, 12);
    else if (/超強気以上|High\s*Vigor|超強勢以上/i.test(blob)) req = Math.max(req, 8);
    else if (/強気以上|Vigor.*High|強勢以上/i.test(blob)) req = Math.max(req, 4);
    m = blob.match(/MP(?:が)?(\d+)以上|MP\s*(\d+)\+/i);
    if (m) req = Math.max(req, parseInt(m[1] || m[2], 10) || 0);
    m = blob.match(/MP消費(\d+)|MP\s*cost\s*(\d+)/i);
    if (m) req = Math.max(req, parseInt(m[1] || m[2], 10) || 0);
    return req;
  }

  function isMoveBeforeOnly(weapon) {
    var blob = weaponEffectBlob(weapon) + ' ' + ((weapon.usage_restrictions || (weapon.raw && weapon.raw.usage_restrictions) || []).join(' '));
    return /移動前限定|Useable only before moving|移動前才|仅限移动前|僅限移動前/i.test(blob);
  }

  function actorHasMoved(actor) {
    if (!actor || actor.startX == null || actor.startY == null) return false;
    return (actor.x | 0) !== (actor.startX | 0) || (actor.y | 0) !== (actor.startY | 0);
  }

  /** gge getValidWeapons — EN / ammo / range(+bonus) / MP / move-before. targetDist=null → MAP pass. */
  function getValidWeapons(actor, targetDist, isSupport) {
    var free = canUseFreeAmmoSkill(actor);
    return (actor.weapons || []).filter(function (w) {
      var enCost, mn, mx, ammo, reqMp, bonus;
      if (!w) return false;
      enCost = getEffectiveEnCost(actor, w, !!isSupport);
      if (!free && enCost > (actor.currentEn | 0)) return false;
      ammo = w.ammo != null ? (w.ammo | 0) : 0;
      if (isMapWeapon(w) && ammo <= 0 && !free) return false;
      if (targetDist !== null && isMapWeapon(w)) return false;
      mn = w.min_range != null ? w.min_range | 0 : 1;
      mx = w.max_range != null ? w.max_range | 0 : mn;
      bonus = getWeaponRangeBonus(actor, w, !!isSupport);
      if (targetDist !== null && ((targetDist | 0) < mn || (targetDist | 0) > (mx + bonus))) return false;
      reqMp = weaponMpRequirement(w);
      if ((actor.mp | 0) < reqMp) return false;
      if (isMoveBeforeOnly(w) && actorHasMoved(actor)) return false;
      return true;
    });
  }

  function hitBuffPct(actor, kind) {
    var bags = abilityTextBags(actor);
    var total = 0;
    var i, t, m, re;
    re = kind === 'eva'
      ? /回避率[^0-9]*?(\d+)%|Evasion(?:\s*rate)?[^0-9]*?(\d+)%|閃避率[^0-9]*?(\d+)%/i
      : /命中率[^0-9]*?(\d+)%|Accuracy(?:\s*rate)?[^0-9]*?(\d+)%/i;
    for (i = 0; i < bags.length; i++) {
      t = normalizeFullwidth(bags[i].text);
      m = t.match(re);
      if (m) total += parseInt(m[1] || m[2] || m[3], 10) || 0;
    }
    if (actor && actor.debuffs) {
      actor.debuffs.forEach(function (d) {
        if (kind === 'hit' && d && d.type === '命中率') total -= d.value | 0;
        if (kind === 'eva' && d && d.type === '回避率') total += d.isUp ? (d.value | 0) : -(d.value | 0);
      });
    }
    return total;
  }

  /**
   * gge checkHit — absolute hit; sway; evade formula when defenseAction==='evade';
   * Otherwise always hits (defend / none / shield).
   */
  function checkHit(attacker, defender, weapon, defenseAction, isDefenderSupportDefend) {
    var mobAtk, mobDef, plAtk, defReact, x, hitRate, blob, m, isEx;
    var charAtk, charDef, hasSway;
    if (isAbsoluteHitWeapon(weapon)) return true;
    /* gge: Sway dodges only the original target, never a Support Defense cover, never vs Absolute Hit. */
    hasSway = defender && defender.activeSkills && defender.activeSkills.some(function (s) {
      return s && /Sway|スウェー/i.test(String(s.name || ''));
    });
    if (hasSway && !isDefenderSupportDefend) {
      defender.usedSwayInCombat = true;
      return false;
    }
    if (defender && defender.hasEvadeWay && !defender.usedEvadeWay) {
      defender.usedEvadeWay = true;
      return false;
    }
    if (defenseAction !== 'evade') return true;

    mobAtk = attacker.mobility | 0;
    mobDef = defender.mobility | 0;
    charAtk = attacker.char && (attacker.char.stats || attacker.char.stats_with_ex) || [];
    charDef = defender.char && (defender.char.stats || defender.char.stats_with_ex) || [];
    function st(list, name) {
      var i, row;
      for (i = 0; i < list.length; i++) {
        row = list[i];
        if (row && String(row.name || '').toLowerCase() === name.toLowerCase()) {
          return row.total != null ? (row.total | 0) : (row.value | 0);
        }
      }
      return 0;
    }
    isEx = !!(weapon.is_ex || (weapon.name && /EX/i.test(weapon.name)));
    blob = weaponEffectBlob(weapon) + ' ' + String((weapon.raw && weapon.raw.attribute) || weapon.attribute || '');
    if (isEx) {
      plAtk = Math.max(st(charAtk, 'Melee'), st(charAtk, 'Ranged'), st(charAtk, 'Awaken'));
    } else if (/格闘|Melee|physical.*melee/i.test(blob + String((weapon.raw && weapon.raw.attack_types) || ''))) {
      plAtk = st(charAtk, 'Melee');
    } else {
      plAtk = st(charAtk, 'Ranged');
    }
    defReact = st(charDef, 'Reaction') || (defender.reaction | 0) || 1000;
    x = 96.45 + (0.00732 * mobAtk - 0.00662 * mobDef) + (plAtk - defReact) / 25;
    hitRate = x + hitBuffPct(attacker, 'hit') - hitBuffPct(defender, 'eva');
    m = normalizeFullwidth(weaponEffectBlob(weapon)).match(/命中率固定(\d+)%|Accuracy\s*fixed\s*(\d+)%/i);
    if (m) hitRate = parseInt(m[1] || m[2], 10) || 0;
    if (weapon.accuracy != null) hitRate += ((weapon.accuracy | 0) - 100);
    else if (weapon.raw && weapon.raw.accuracy != null) hitRate += ((weapon.raw.accuracy | 0) - 100);
    if (hitRate < 0) hitRate = 0;
    return (nextRandom() * 100) <= hitRate;
  }

  /** gge calculateCriticalRate — weapon base + ability / OP / SD-tag lines. */
  function calculateCriticalRate(attacker, weapon, defender) {
    var rate = 0;
    var bags, i, t, m, maxEn, curEn, enOk;
    if (weapon) {
      if (weapon.critical != null) rate += weapon.critical | 0;
      else if (weapon.raw && weapon.raw.critical != null) rate += weapon.raw.critical | 0;
    }
    bags = abilityTextBags(attacker);
    maxEn = (attacker && attacker.maxEn) || 100;
    curEn = attacker && attacker.currentEn != null ? attacker.currentEn : maxEn;
    for (i = 0; i < bags.length; i++) {
      t = normalizeFullwidth(bags[i].text);
      if (/テンション.*?時|超一撃EX|Supercharged\s*EX/i.test(t) && !/テンション(?:が)?(?:「)?/.test(t)) {
        /* skip tension-gated lines handled below */
      }
      enOk = true;
      m = t.match(/EN(?:が)?(\d+)%以上/);
      if (m && maxEn > 0 && (curEn / maxEn) * 100 < (parseInt(m[1], 10) || 0)) enOk = false;
      if (enOk && !/テンション.*?時/.test(t)) {
        m = t.match(/クリティカル(?:発生)?率[^0-9]*?(\d+)|Critical(?:\s*rate)?[^0-9]*?(\d+)/i);
        if (m && /上昇|increase|\+/i.test(t)) rate += parseInt(m[1] || m[2], 10) || 0;
      }
      m = t.match(/テンション(?:が)?(?:「)?(.+?)(?:」)?以上の時.*クリティカル率\+(\d+)/);
      if (m) {
        if ((m[1].indexOf('超一撃') >= 0 && (attacker.mp | 0) >= 12) ||
            (m[1].indexOf('超強気') >= 0 && (attacker.mp | 0) >= 8) ||
            (m[1].indexOf('強気') >= 0 && (attacker.mp | 0) >= 6)) {
          rate += parseInt(m[2], 10) || 0;
        }
      }
    }
    if (weapon && defender && defender.unit) {
      t = normalizeFullwidth(weaponEffectBlob(weapon));
      if (/SDガンダム|SD Gundam/i.test(t)) {
        var tags = defender.unit.tags || [];
        if (tags.some(function (tg) { return /SD/i.test(String(tg)); })) return 100;
      }
    }
    if (attacker && (attacker.exCritBonus | 0) > 0) rate += attacker.exCritBonus | 0;
    if (attacker && (attacker.skillCritBonus | 0) > 0) rate += attacker.skillCritBonus | 0;
    if (rate > 100) rate = 100;
    if (rate < 0) rate = 0;
    return rate;
  }

  /** gge checkAndAcquireUnconditionalCS — Supercharged + pilot ability, once/battle. */
  function checkAndAcquireUnconditionalCS(actor) {
    var bags, i, t;
    if (!actor || actor.hasAcquiredUnconditionalCS) return false;
    if (actor.hp != null && (actor.hp | 0) <= 0) return false;
    if ((actor.mp | 0) < 12) return false;
    bags = abilityTextBags(actor);
    for (i = 0; i < bags.length; i++) {
      t = normalizeFullwidth(bags[i].text);
      if (!/無条件チャンスステップ|Unconditional\s*Chance\s*Step|無條件額外行動|无条件额外行动/i.test(t)) continue;
      actor.hasAcquiredUnconditionalCS = true;
      actor.unconditionalCSStock = (actor.unconditionalCSStock | 0) + 1;
      return true;
    }
    return false;
  }

  /** World cells for MAP weapon from master map_coords + facing. */
  function mapWeaponWorldCells(actor, weapon) {
    var dir = actor.direction != null ? (actor.direction | 0) : (actor.side === 'ally' ? 3 : 1);
    var ax = actor.x | 0;
    var ay = actor.y | 0;
    var coords = (weapon.map_coords || (weapon.raw && weapon.raw.map_coords) || []);
    return coords.map(function (c) {
      var lx = c.x | 0;
      var ly = c.y | 0;
      if (dir === 1) return { x: ax + ly, y: ay + lx };
      if (dir === 3) return { x: ax - ly, y: ay - lx };
      if (dir === 2) return { x: ax + lx, y: ay + ly };
      return { x: ax - lx, y: ay - ly };
    });
  }

  function unitOverlapsCells(unit, cells) {
    var size = unitSize(unit);
    var ux = unit.x | 0;
    var uy = unit.y | 0;
    var i, c, x, y;
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      for (x = ux; x < ux + size; x++) {
        for (y = uy; y < uy + size; y++) {
          if (c.x === x && c.y === y) return true;
        }
      }
    }
    return false;
  }

  /** MAP hit test: gge uses the unit’s placement anchor, not any overlapping footprint cell. */
  function unitAnchorInCells(unit, cells) {
    var ux = unit.x | 0;
    var uy = unit.y | 0;
    var i, c;
    for (i = 0; i < (cells || []).length; i++) {
      c = cells[i];
      if ((c.x | 0) === ux && (c.y | 0) === uy) return true;
    }
    return false;
  }

  /**
   * gge MAP interrupt — use any is_map with ammo when AoE beats single-target
   * (master map_coords instead of JP name whitelist; same decision math).
   */
  function evaluateMapWeapon(actor, target, foes, allUnits, bounds, damageOf) {
    var candidates = getValidWeapons(actor, null, false).filter(isMapWeapon);
    var best = null;
    var ci, wpn, free, cost, canFire, rawDist, mn, mx, needMove, simPos, m;
    var cells, inArea, maxSel, isSingle, minNeed, mapKills, mainDmg, totalDmg, i, mt, mDmg;
    var normalPick, normalDmg, normalKills, better;

    for (ci = 0; ci < candidates.length; ci++) {
      wpn = candidates[ci];
      free = canUseFreeAmmoSkill(actor);
      cost = getEffectiveEnCost(actor, wpn, false);
      canFire = ((wpn.ammo | 0) > 0 && (actor.currentEn | 0) >= cost) || free;
      if (!canFire) continue;
      if (isMoveBeforeOnly(wpn) && actorHasMoved(actor)) continue;

      mn = wpn.min_range != null ? wpn.min_range | 0 : 1;
      mx = wpn.max_range != null ? wpn.max_range | 0 : 5;
      rawDist = distance(actor, target);
      needMove = rawDist > mx || rawDist < mn;
      if (isMoveBeforeOnly(wpn) && needMove) continue;

      simPos = { x: actor.x | 0, y: actor.y | 0, size: unitSize(actor), side: actor.side };
      if (needMove) {
        var dest = getBestMoveDestination(actor, target, actor.move | 0, mn, mx, allUnits, bounds);
        if (!dest) continue;
        simPos.x = dest.x;
        simPos.y = dest.y;
      }
      if (distance(simPos, target) < mn || distance(simPos, target) > mx) continue;

      cells = mapWeaponWorldCells(simPos, wpn);
      if (!cells.length) {
        /* No master map_coords → skip (do not fake a full min–max range blast). */
        continue;
      }
      /* Large units: only the anchor cell (unit.x/y) counts — corner-graze on a 2×2 must not pull them in. */
      inArea = alive(foes).filter(function (e) {
        return unitAnchorInCells(e, cells);
      });
      if (!inArea.some(function (e) { return e === target; })) continue;

      maxSel = 0;
      m = normalizeFullwidth(weaponEffectBlob(wpn) + ' ' + ((wpn.usage_restrictions || []).join(' ')))
        .match(/(?:選択地点|ターゲット|designate|spots?).*?(\d+)/i);
      if (m) maxSel = parseInt(m[1], 10) || 0;
      if (maxSel > 0) {
        inArea = inArea.slice().sort(function (a, b) {
          return (a.hp | 0) - (b.hp | 0);
        }).slice(0, maxSel);
      }

      isSingle = maxSel > 0 || !!(wpn.map_single_pou || (wpn.raw && wpn.raw.map_single_pou)) ||
        ((wpn.min_range | 0) === 1 && (wpn.max_range | 0) === 1);
      minNeed = isSingle ? 1 : 2;
      if (inArea.length < minNeed) continue;

      mapKills = 0;
      mainDmg = 0;
      totalDmg = 0;
      for (i = 0; i < inArea.length; i++) {
        mt = inArea[i];
        mDmg = typeof damageOf === 'function' ? (damageOf(actor, mt, wpn) | 0) : (wpn.power | 0);
        totalDmg += mDmg;
        if ((mt.hp | 0) - mDmg <= 0) mapKills++;
        if (mt === target) mainDmg = mDmg;
      }

      normalPick = pickWeapon(
        { weapons: (actor.weapons || []).filter(function (w) { return !isMapWeapon(w); }), x: simPos.x, y: simPos.y, size: simPos.size, side: actor.side },
        target,
        function (a, d, w) {
          return typeof damageOf === 'function' ? damageOf(actor, d, w) : (w.power | 0);
        }
      );
      normalDmg = normalPick ? (normalPick.damage | 0) : 0;
      normalKills = (target.hp | 0) - normalDmg <= 0 ? 1 : 0;

      better = false;
      if (mapKills > normalKills) better = true;
      else if (mapKills === normalKills) {
        if (mapKills === 0) better = totalDmg >= normalDmg;
        else if (mainDmg > normalDmg) better = true;
        else if (mainDmg === normalDmg && inArea.length > 1) better = true;
      }
      if (!better) continue;
      if (!best || mapKills > best.mapKills || (mapKills === best.mapKills && totalDmg > best.totalDmg)) {
        best = {
          weapon: wpn,
          targets: inArea,
          cells: cells.slice(),
          moveTo: needMove ? { x: simPos.x, y: simPos.y } : null,
          mapKills: mapKills,
          totalDmg: totalDmg,
          enCost: cost,
          freeAmmo: free
        };
      }
    }
    return best;
  }

  /**
   * gge combatQueue builder — waves:
   * 0 preempt (rewritten), 1 SA, 2 main, 3 support-counter, 4 counter.
   */
  function buildCombatQueue(actor, target, weapon, friends, foes, damageOf) {
    var dist = distance(actor, target);
    var queue = [];
    var defenderAction = 'none';
    var actualDefender = target;
    var bestGuard = pickSupportDefender(target, foes);
    var tempExpected = 0;
    var tempDefAction = 'none';
    var isTargetCountering = true;
    var counterGuard = null;
    var actualCounterDefender = actor;
    var counterDefAction = 'none';
    var bestCounterWpn = null;
    var predictedHp, actorPredictedHp;
    var saCands, i, su, distS, bg, scored, counterWpns, hasPreCounter;

    function bestWpnAt(cand, tgt, d) {
      var wpns = getValidWeapons(cand, d, true).filter(function (w) { return !isMapWeapon(w); });
      var ranked = rankWeaponsByDamage(cand, tgt, wpns, damageOf);
      return ranked.length ? ranked[0].weapon : null;
    }

    if (bestGuard) {
      bestGuard.usedSupportDefendCount = (bestGuard.usedSupportDefendCount | 0) + 1;
      bestGuard.battleSupportDefendedCount = (bestGuard.battleSupportDefendedCount | 0) + 1;
      actualDefender = bestGuard;
      defenderAction = hasShieldMechanism(bestGuard) ? 'shield' : 'defend';
    }

    if (!bestGuard) {
      tempExpected = typeof damageOf === 'function' ? (damageOf(actor, actualDefender, weapon) | 0) : (weapon.power | 0);
      saCands = alive(friends).filter(function (u) {
        return u !== actor && supportAttackRemaining(u) > 0;
      });
      for (i = 0; i < saCands.length; i++) {
        su = saCands[i];
        distS = distance(su, target);
        bg = bestWpnAt(su, target, distS);
        if (bg && (su.currentEn | 0) >= getEffectiveEnCost(su, bg, true)) {
          tempExpected += typeof damageOf === 'function' ? (damageOf(su, actualDefender, bg) | 0) : (bg.power | 0);
        }
      }
      counterWpns = getValidWeapons(target, dist, false).filter(function (w) { return !isMapWeapon(w); });
      hasPreCounter = counterWpns.some(function (w) { return isPreemptiveWeapon(target, w); });
      tempDefAction = determineDefenseAction(target, tempExpected, counterWpns.length > 0, hasPreCounter);
    }

    predictedHp = actualDefender.hp | 0;
    predictedHp -= typeof damageOf === 'function' ? (damageOf(actor, actualDefender, weapon) | 0) : (weapon.power | 0);

    saCands = alive(friends).filter(function (u) {
      return u !== actor && supportAttackRemaining(u) > 0;
    }).map(function (su) {
      distS = distance(su, target);
      bg = bestWpnAt(su, target, distS);
      if (!bg || (su.currentEn | 0) < getEffectiveEnCost(su, bg, true)) return null;
      return { unit: su, dist: distS, wpn: bg, spd: (su.mobility | 0) + (su.reaction | 0) };
    }).filter(Boolean).sort(function (a, b) { return b.spd - a.spd; });

    for (i = 0; i < saCands.length; i++) {
      if (predictedHp <= 0) break;
      queue.push({
        wave: 1, type: 'support', attacker: saCands[i].unit, defender: actualDefender,
        weapon: saCands[i].wpn, distance: saCands[i].dist,
        forcedDefenderAction: bestGuard ? defenderAction : undefined,
        originalTarget: target
      });
      predictedHp -= typeof damageOf === 'function'
        ? (damageOf(saCands[i].unit, actualDefender, saCands[i].wpn) | 0)
        : (saCands[i].wpn.power | 0);
    }

    queue.push({
      wave: 2, type: 'main', attacker: actor, defender: actualDefender,
      weapon: weapon, distance: dist,
      forcedDefenderAction: bestGuard ? defenderAction : undefined,
      originalTarget: target
    });

    if (!bestGuard) {
      defenderAction = tempDefAction;
      if (defenderAction !== 'none') isTargetCountering = false;
    }

    if (isTargetCountering) {
      counterGuard = pickCounterSupportDefender(actor, friends);
      if (counterGuard) {
        counterGuard.usedSupportDefendCount = (counterGuard.usedSupportDefendCount | 0) + 1;
        counterGuard.battleSupportDefendedCount = (counterGuard.battleSupportDefendedCount | 0) + 1;
        actualCounterDefender = counterGuard;
        counterDefAction = hasShieldMechanism(counterGuard) ? 'shield' : 'defend';
      }
    }

    actorPredictedHp = actualCounterDefender.hp | 0;
    if (isTargetCountering) {
      counterWpns = getValidWeapons(target, dist, false).filter(function (w) { return !isMapWeapon(w); });
      if (counterWpns.length) {
        scored = rankWeaponsByDamage(target, actualCounterDefender, counterWpns, damageOf).map(function (row) {
          return {
            weapon: row.weapon,
            dmg: row.dmg,
            power: row.power,
            rankKey: row.rankKey,
            calFailed: row.calFailed,
            isPre: isPreemptiveWeapon(target, row.weapon)
          };
        });
        scored.sort(function (a, b) {
          var canSurvive = bestGuard || ((target.hp | 0) > tempExpected);
          var aKill, bKill;
          var aKey = a.rankKey | 0;
          var bKey = b.rankKey | 0;
          if (!canSurvive) {
            if (a.isPre && !b.isPre) return -1;
            if (!a.isPre && b.isPre) return 1;
            if (bKey !== aKey) return bKey - aKey;
            return (b.power | 0) - (a.power | 0);
          }
          aKill = a.isPre && aKey >= actorPredictedHp;
          bKill = b.isPre && bKey >= actorPredictedHp;
          if (aKill && !bKill) return -1;
          if (!aKill && bKill) return 1;
          if (bKey !== aKey) return bKey - aKey;
          if (a.weapon.is_ex && !b.weapon.is_ex) return -1;
          if (!a.weapon.is_ex && b.weapon.is_ex) return 1;
          return (b.power | 0) - (a.power | 0);
        });
        bestCounterWpn = scored[0].weapon;
        actorPredictedHp -= (scored[0].rankKey | 0);
      }
    }

    /* Wave 3: support counters always searched (even if main target defends).
       gge: one queue entry per unit per combat; multi-use stock spans engagements. */
    {
      var eSup = alive(foes).filter(function (u) {
        return u !== target && supportAttackRemaining(u) > 0;
      }).map(function (su) {
        distS = distance(su, actor);
        bg = bestWpnAt(su, actor, distS);
        if (!bg || (su.currentEn | 0) < getEffectiveEnCost(su, bg, true)) return null;
        return { unit: su, dist: distS, wpn: bg, spd: (su.mobility | 0) + (su.reaction | 0) };
      }).filter(Boolean).sort(function (a, b) { return b.spd - a.spd; });
      for (i = 0; i < eSup.length; i++) {
        if (actorPredictedHp <= 0) break;
        queue.push({
          wave: 3, type: 'support_counter', attacker: eSup[i].unit, defender: actualCounterDefender,
          weapon: eSup[i].wpn, distance: eSup[i].dist,
          forcedDefenderAction: counterGuard ? counterDefAction : undefined,
          originalTarget: actor
        });
        actorPredictedHp -= typeof damageOf === 'function'
          ? (damageOf(eSup[i].unit, actualCounterDefender, eSup[i].wpn) | 0)
          : (eSup[i].wpn.power | 0);
      }
    }

    if (isTargetCountering && bestCounterWpn) {
      queue.push({
        wave: 4, type: 'counter', attacker: target, defender: actualCounterDefender,
        weapon: bestCounterWpn, distance: dist,
        forcedDefenderAction: counterGuard ? counterDefAction : undefined,
        originalTarget: actor
      });
    }

    /* Wave 0: pull preemptive weapons to front. */
    queue.forEach(function (q) {
      if (isPreemptiveWeapon(q.attacker, q.weapon)) q.wave = 0;
    });

    queue.sort(function (a, b) {
      var spdA, spdB;
      if (a.wave !== b.wave) return a.wave - b.wave;
      spdA = (a.attacker.mobility | 0) + (a.attacker.reaction | 0);
      spdB = (b.attacker.mobility | 0) + (b.attacker.reaction | 0);
      return spdB - spdA;
    });

    return {
      queue: queue,
      defenderAction: defenderAction,
      actualDefender: actualDefender,
      bestGuard: bestGuard,
      counterGuard: counterGuard,
      actualCounterDefender: actualCounterDefender,
      counterDefAction: counterDefAction,
      isTargetCountering: isTargetCountering
    };
  }

  /**
   * Neo Zeong–class Cond:Area weapon-power auras (+ Full Frontal AuraBuffValueAddition).
   * Matches app.py weapon_matches_sim_weapon_power_effect / sum_aura_weapon_power_rate_pct.
   * range_min/max on the effect are Manhattan tiles from the aura source to the attacker.
   */
  function weaponAttrKeys(weapon) {
    var raw = weapon && weapon.raw ? weapon.raw : weapon;
    var keys = [];
    var attr = String((raw && raw.attribute) || (weapon && weapon.attribute) || '').toLowerCase();
    if (/beam|ビーム|光束|鐳射/.test(attr)) keys.push('beam');
    if (/physical|物理/.test(attr)) keys.push('physical');
    if (/special|特殊/.test(attr)) keys.push('special');
    return keys;
  }

  function weaponAtkTypeKeys(weapon) {
    var raw = weapon && weapon.raw ? weapon.raw : weapon;
    var out = [];
    var types = (raw && raw.attack_types) || [];
    var i, t;
    for (i = 0; i < types.length; i++) {
      t = types[i];
      if (!t) continue;
      if (typeof t === 'string') out.push(String(t).toLowerCase());
      else if (t.key) out.push(String(t.key).toLowerCase());
      else if (t.label) out.push(String(t.label).toLowerCase());
    }
    return out;
  }

  function effectMatchesWeapon(effect, weapon) {
    var wantAttrs, wantTypes, haveAttrs, haveTypes;
    if (!effect || effect.kind !== 'weapon_power_pct') return false;
    wantAttrs = (effect.weapon_attrs || []).map(function (x) { return String(x).toLowerCase(); });
    wantTypes = (effect.attack_types || []).map(function (x) { return String(x).toLowerCase(); });
    if (!wantAttrs.length || !wantTypes.length) return false;
    haveAttrs = weaponAttrKeys(weapon);
    haveTypes = weaponAtkTypeKeys(weapon);
    if (!haveAttrs.length || !haveTypes.length) return false;
    if (!wantAttrs.some(function (a) { return haveAttrs.indexOf(a) >= 0; })) return false;
    if (!wantTypes.some(function (t) { return haveTypes.indexOf(t) >= 0; })) return false;
    return true;
  }

  function collectSimEffects(entity) {
    var out = [];
    var bags = [];
    var i, ab, se, j;
    if (entity && entity.unit && entity.unit.abilities) bags.push(entity.unit.abilities);
    if (entity && entity.char && entity.char.abilities) bags.push(entity.char.abilities);
    bags.forEach(function (list) {
      for (i = 0; i < list.length; i++) {
        ab = list[i];
        se = ab && ab.sim_effects;
        if (!Array.isArray(se)) continue;
        for (j = 0; j < se.length; j++) out.push(se[j]);
      }
    });
    return out;
  }

  /**
   * Cond:Area weapon-power auras (Neo Zeong EX etc.) — range_min/max are Manhattan
   * tiles from the source footprint (gge getDistance). Includes ability icon for HUD.
   */
  function listAreaAuras(entity) {
    var out = [];
    var bags = [];
    var i, ab, se, j, e;
    if (entity && entity.unit && entity.unit.abilities) bags.push(entity.unit.abilities);
    if (entity && entity.char && entity.char.abilities) bags.push(entity.char.abilities);
    bags.forEach(function (list) {
      for (i = 0; i < list.length; i++) {
        ab = list[i];
        se = ab && ab.sim_effects;
        if (!Array.isArray(se)) continue;
        for (j = 0; j < se.length; j++) {
          e = se[j];
          if (!e || !e.is_area_aura || e.kind !== 'weapon_power_pct') continue;
          out.push({
            range_min: e.range_min | 0,
            range_max: e.range_max | 0,
            value: e.value | 0,
            icon: (ab && ab.icon) || '',
            name: (ab && (ab.display_name || ab.name)) || '',
            weapon_attrs: e.weapon_attrs || [],
            attack_types: e.attack_types || []
          });
        }
      }
    });
    return out;
  }

  function distUnitToCell(unit, x, y) {
    return distance(unit, { x: x | 0, y: y | 0, size: 1 });
  }

  function cellInAreaAura(src, x, y, aura) {
    var dist;
    if (!src || !aura) return false;
    dist = distUnitToCell(src, x, y);
    if ((aura.range_min | 0) > 0 && dist < (aura.range_min | 0)) return false;
    if ((aura.range_max | 0) > 0 && dist > (aura.range_max | 0)) return false;
    if ((aura.range_max | 0) <= 0 && (aura.range_min | 0) <= 0) return false;
    return dist > 0;
  }

  /** Opposing Cond:Area auras covering `unit` (same range gate as areaWeaponPowerAuraPct). */
  function opposingAreaAurasOn(unit, allUnits) {
    var out = [];
    var seen = {};
    var i, list, a, key, dist;
    if (!unit || (unit.hp | 0) <= 0) return out;
    alive(allUnits).forEach(function (srcU) {
      if (!srcU || srcU === unit || srcU.side === unit.side) return;
      dist = distance(srcU, unit);
      list = listAreaAuras(srcU);
      for (i = 0; i < list.length; i++) {
        a = list[i];
        if ((a.range_min | 0) > 0 && dist < (a.range_min | 0)) continue;
        if ((a.range_max | 0) > 0 && dist > (a.range_max | 0)) continue;
        if (dist <= 0) continue;
        key = String(a.icon || a.name || i);
        if (seen[key]) continue;
        seen[key] = 1;
        out.push(a);
      }
    });
    return out;
  }

  function areaWeaponPowerAuraPct(attacker, auraSources, weapon) {
    var effects = [];
    var i, src, dist, list, e, base, matched, add;
    alive(auraSources).forEach(function (srcU) {
      if (!srcU || srcU === attacker) return;
      if (srcU.side === attacker.side) return;
      dist = distance(srcU, attacker);
      list = collectSimEffects(srcU);
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (!e || !e.is_area_aura || e.kind !== 'weapon_power_pct') continue;
        if ((e.range_min | 0) > 0 && dist < (e.range_min | 0)) continue;
        if ((e.range_max | 0) > 0 && dist > (e.range_max | 0)) continue;
        effects.push(e);
      }
      /* Pilot AuraBuffValueAddition (e.g. Full Frontal −15) — stacks only with a matching WP aura. */
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (e && e.kind === 'aura_buff_value_addition') effects.push(e);
      }
    });
    base = 0;
    matched = false;
    add = 0;
    for (i = 0; i < effects.length; i++) {
      e = effects[i];
      if (e.kind === 'weapon_power_pct' && effectMatchesWeapon(e, weapon)) {
        base += e.value | 0;
        matched = true;
      } else if (e.kind === 'aura_buff_value_addition') {
        add += e.value | 0;
      }
    }
    if (!matched) return 0;
    return base + add;
  }

  /**
   * Rank weapons for AI pick. Prefers real /cal damage; if cal collapses to raw
   * power (common on EX when a trait path throws), fall back to power order so
   * Mega Cannon EX is not beaten by Wired Claw Arm.
   */
  function rankWeaponsByDamage(actor, defender, weapons, damageOf) {
    var scored = (weapons || []).map(function (w) {
      var dmg = typeof damageOf === 'function' ? (damageOf(actor, defender, w) | 0) : (w.power | 0);
      var pow = w.power | 0;
      /* /cal returned ~raw power while ML fights are 20–40× — treat as failed preview. */
      var calFailed = pow > 0 && dmg > 0 && dmg < pow * 3;
      return { weapon: w, dmg: dmg, power: pow, calFailed: calFailed, isEx: !!w.is_ex };
    });
    var scales = scored.filter(function (s) { return !s.calFailed && s.power > 0; })
      .map(function (s) { return s.dmg / s.power; });
    var scale = scales.length ? Math.max.apply(null, scales) : 1;
    scored.forEach(function (s) {
      s.rankKey = s.calFailed ? Math.floor(s.power * scale) : s.dmg;
    });
    scored.sort(function (a, b) {
      if (b.rankKey !== a.rankKey) return b.rankKey - a.rankKey;
      if (a.isEx && !b.isEx) return -1;
      if (!a.isEx && b.isEx) return 1;
      return b.power - a.power;
    });
    return scored;
  }

  /**
   * gge executeAttack weapon MP cost (non-support, non-MAP).
   * Pilot 「消費MPがN軽減」 reduces the cost.
   */
  function weaponMpCost(actor, weapon, isSupport) {
    var blob, m, cost, bags, i, t, red;
    if (!weapon || isSupport || isMapWeapon(weapon)) return 0;
    blob = normalizeFullwidth(weaponEffectBlob(weapon));
    m = blob.match(/MP消費(\d+)|Consumes?\s*(\d+)\s*MP|MP\s*cost\s*(\d+)/i);
    if (!m) return 0;
    cost = parseInt(m[1] || m[2] || m[3], 10) || 0;
    bags = abilityTextBags(actor);
    for (i = 0; i < bags.length; i++) {
      t = normalizeFullwidth(bags[i].text);
      red = t.match(/消費MP(?:が)?(\d+)軽減|MP\s*cost\s*(?:reduc\w*\s*)?(\d+)/i);
      if (red) cost = Math.max(0, cost - (parseInt(red[1] || red[2], 10) || 0));
    }
    return cost;
  }

  /**
   * gge evaluateExPhase — Supercharged (超一撃) EX1/EX2 progression.
   * EN/JA ability text; applies 1-turn crit / DR flags used by calculateCriticalRate + /cal.
   */
  function evaluateExPhase(actor) {
    var bags = [];
    var ex1 = null;
    var ex2 = null;
    var hasMpDrop = false;
    var phase, text, i, ab, texts, j, t, m;
    if (!actor) return false;
    if (actor.exProgressedThisTurn) return false;
    if (actor.chouIchigekiExPhase == null) actor.chouIchigekiExPhase = 0;
    if (actor.char && actor.char.abilities) bags.push(actor.char.abilities);
    if (actor.unit && actor.unit.abilities) bags.push(actor.unit.abilities);
    bags.forEach(function (list) {
      for (i = 0; i < list.length; i++) {
        ab = list[i];
        texts = detailTexts(ab);
        for (j = 0; j < texts.length; j++) {
          t = String(texts[j] || '');
          if (/超一撃\s*EX\s*1|Supercharged\s*EX\s*1|超一擊\s*EX\s*1/i.test(t)) ex1 = t;
          if (/超一撃\s*EX\s*2|Supercharged\s*EX\s*2|超一擊\s*EX\s*2/i.test(t)) ex2 = t;
          if (/次のターンMP\s*12\s*減少|next turn.*MP.*12.*decreas/i.test(t)) hasMpDrop = true;
        }
      }
    });
    if (!ex1 && !ex2 && !hasMpDrop) return false;
    phase = actor.chouIchigekiExPhase | 0;
    text = null;
    if (phase === 0 && (actor.mp | 0) >= 12 && ex1) {
      text = ex1;
      actor.chouIchigekiExPhase = 1;
    } else if (phase === 1 && ex2) {
      text = ex2;
      actor.chouIchigekiExPhase = 2;
    } else {
      return false;
    }
    actor.exProgressedThisTurn = true;
    actor.isMpLocked = true;
    actor.exCritBonus = 0;
    actor.exDamageTakenDown = 0;
    m = text.match(/Critical\s*rate.*?(\d+)\s*%|クリティカル率.*?(\d+)\s*[%％]|爆擊率.*?(\d+)\s*%/i);
    if (m) actor.exCritBonus = parseInt(m[1] || m[2] || m[3], 10) || 0;
    if (/Critical(?:\s*hit)?\s*(?:confirm|100%)|クリティカル(?:確定|100%)/i.test(text)) {
      actor.exCritBonus = Math.max(actor.exCritBonus | 0, 1000);
    }
    m = text.match(/(?:damage taken|被ダメージ|受到損傷).*?(\d+)\s*[%％]/i);
    if (m) actor.exDamageTakenDown = parseInt(m[1], 10) || 0;
    return true;
  }

  function consumeWeaponCost(actor, weapon, isSupport) {
    var cost, free, mpCost;
    if (!actor || !weapon) return { en: 0, ammo: false, free: false, mp: 0 };
    free = canUseFreeAmmoSkill(actor);
    cost = getEffectiveEnCost(actor, weapon, !!isSupport);
    mpCost = weaponMpCost(actor, weapon, !!isSupport);
    if (mpCost > 0) {
      actor.mp = Math.max(0, (actor.mp | 0) - mpCost);
      actor.tension = Math.min(100, Math.round(((actor.mp | 0) / 12) * 100));
    }
    if (!free) {
      actor.currentEn = Math.max(0, (actor.currentEn | 0) - cost);
      if (isMapWeapon(weapon) && (weapon.ammo | 0) > 0) {
        weapon.ammo = (weapon.ammo | 0) - 1;
        if (weapon.raw && weapon.raw.ammo != null) weapon.raw.ammo = weapon.ammo;
      }
    } else if (isMapWeapon(weapon)) {
      actor.hasUsedFreeAmmoSkillInBattle = true;
    }
    return { en: free ? 0 : cost, ammo: !free && isMapWeapon(weapon), free: free, mp: mpCost };
  }

  /**
   * Battle-start MP — same phrasing as /cal `_dcAccumMpBonusFromResolved`
   * (EN Increase MP by N / JA 自身のMPがN上昇 / TW·HK 自身MP增加|提升).
   * Conditions use detailConditionsMet (own unit tags / series / role).
   */
  function parseStartingMpFromText(text) {
    var norm, m;
    if (!text) return 0;
    norm = normalizeFullwidth(String(text)).replace(/\n/g, ' ');
    if (/戦闘開始時[^\n]{0,24}超一撃|start of (?:battle|combat)[^\n]{0,40}Supercharged|戰鬥開始[^\n]{0,24}超一擊/i.test(norm)) {
      return 12;
    }
    m = norm.match(/[Ii]ncrease\s+(?:own\s+)?MP\s+by\s+(\d+)/i)
      || norm.match(/(?:自身の)?MP(?:が|を)\s*(\d+)\s*上昇/)
      || norm.match(/自身MP(?:增加|提升)(\d+)/)
      || norm.match(/MP\s*\+\s*(\d+)(?:\s*\(|\s*$|\s*[,.，。])/);
    return m ? (parseInt(m[1], 10) || 0) : 0;
  }

  function startingMpBonus(actor) {
    var total = 0;
    var fromTrait;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var v;
      if (detail && !detailConditionsMet(actor, detail)) return;
      /* Skip weapon-on-hit / MAP supply wording — not battle-start MP. */
      if (/on hit|MAP Weapon|MP Supply|敵.*MP|enemy MP|Decrease.*MP/i.test(text || '')) return;
      v = parseStartingMpFromText(text);
      if (v > 0) total += v;
    });
    /* Unit-skill MpBoost trait (type 12) only — text-only “on skill use” MP is not battle-start. */
    ((actor && actor.unit && actor.unit.skills) || []).forEach(function (sk) {
      fromTrait = 0;
      (sk.traits || []).forEach(function (tr) {
        if (String(tr.trait_type_index || '') === '12') {
          fromTrait += Math.max(0, parseInt(tr.trait_value, 10) || 0);
        }
      });
      if (fromTrait > 0) total += fromTrait;
    });
    return Math.max(0, Math.min(12, total | 0));
  }

  var api = {
    setRandom: setRandom,
    unitSize: unitSize,
    distance: distance,
    chebyshev: distance,
    checkOverlap: checkOverlap,
    actionOrder: actionOrder,
    weaponsInRange: weaponsInRange,
    getWeaponRangeBonus: getWeaponRangeBonus,
    isMapWeapon: isMapWeapon,
    weaponEffectBlob: weaponEffectBlob,
    weaponMpCost: weaponMpCost,
    getReachableCells: getReachableCells,
    getBestMoveDestination: getBestMoveDestination,
    pickEngage: pickEngage,
    pickTarget: pickTarget,
    nearestEnemy: nearestEnemy,
    pickWeapon: pickWeapon,
    supportDefendLimit: supportDefendLimit,
    effectiveSupportDefendLimit: effectiveSupportDefendLimit,
    supportDefendRemaining: supportDefendRemaining,
    supportDefendRangeBonus: supportDefendRangeBonus,
    supportAttackLimit: supportAttackLimit,
    effectiveSupportAttackLimit: effectiveSupportAttackLimit,
    supportAttackRemaining: supportAttackRemaining,
    pickSupportDefender: pickSupportDefender,
    pickCounterSupportDefender: pickCounterSupportDefender,
    pickSupportAttacker: pickSupportAttacker,
    canCounterSupportDefend: canCounterSupportDefend,
    canSupportDefendOnTarget: canSupportDefendOnTarget,
    unitOccupancyMode: unitOccupancyMode,
    terrainRowLevel: terrainRowLevel,
    buildPilotSkillKit: buildPilotSkillKit,
    pickSkill: pickSkill,
    planUnitSkill: planUnitSkill,
    enemyCanCounter: enemyCanCounter,
    chanceStepLimit: chanceStepLimit,
    rankedPoints: rankedPoints,
    determineDefenseAction: determineDefenseAction,
    isPreemptiveWeapon: isPreemptiveWeapon,
    isAbsoluteHitWeapon: isAbsoluteHitWeapon,
    weaponGrantsUnconditionalCsOnHit: weaponGrantsUnconditionalCsOnHit,
    canUseFreeAmmoSkill: canUseFreeAmmoSkill,
    getEffectiveEnCost: getEffectiveEnCost,
    getValidWeapons: getValidWeapons,
    checkHit: checkHit,
    calculateCriticalRate: calculateCriticalRate,
    checkAndAcquireUnconditionalCS: checkAndAcquireUnconditionalCS,
    evaluateMapWeapon: evaluateMapWeapon,
    mapWeaponWorldCells: mapWeaponWorldCells,
    buildCombatQueue: buildCombatQueue,
    consumeWeaponCost: consumeWeaponCost,
    hasShieldMechanism: hasShieldMechanism,
    isMoveBeforeOnly: isMoveBeforeOnly,
    areaWeaponPowerAuraPct: areaWeaponPowerAuraPct,
    rankWeaponsByDamage: rankWeaponsByDamage,
    effectMatchesWeapon: effectMatchesWeapon,
    evaluateExPhase: evaluateExPhase,
    startingMpBonus: startingMpBonus,
    detailConditionsMet: detailConditionsMet,
    listAreaAuras: listAreaAuras,
    cellInAreaAura: cellInAreaAura,
    distUnitToCell: distUnitToCell,
    opposingAreaAurasOn: opposingAreaAurasOn
  };
  root.MlsRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
