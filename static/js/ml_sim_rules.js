/* Master League turn rules — client combat/move engine:
   distance (Manhattan+size), reachable cells / best move (4-dir BFS),
   achievableTargets → lowest HP, support-defend limits / cover search, pilot skills.
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

  /** MLS getDistance — orthogonal gap between footprints (NOT Chebyshev). */
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

  /**
   * 2×2 expands behind facing (same as ml_sim footprintCells):
   * dir 1 Right → −x; dir 3 Left → +x; plus one cell down (−y).
   * AABB checkOverlap grows +y and misses the real −y lobe — do not use it for landing.
   */
  function footprintDx(side, direction) {
    var dir = direction != null ? (direction | 0) : (side === 'ally' ? 3 : 1);
    if (dir === 1) return -1;
    if (dir === 3) return 1;
    return side === 'ally' ? 1 : -1;
  }

  function footprintCellsAt(x, y, size, side, direction) {
    var dx;
    x = x | 0;
    y = y | 0;
    if (!(size > 1)) return [{ x: x, y: y }];
    dx = footprintDx(side, direction);
    return [
      { x: x, y: y },
      { x: x + dx, y: y },
      { x: x, y: y - 1 },
      { x: x + dx, y: y - 1 }
    ];
  }

  function footprintsOverlap(cellsA, cellsB) {
    var i, j, a, b;
    for (i = 0; i < (cellsA || []).length; i++) {
      a = cellsA[i];
      if (!a) continue;
      for (j = 0; j < (cellsB || []).length; j++) {
        b = cellsB[j];
        if (b && (a.x | 0) === (b.x | 0) && (a.y | 0) === (b.y | 0)) return true;
      }
    }
    return false;
  }

  /** True if a unit of `size` at (x,y) would share a cell with `other`. */
  function wouldOverlapUnit(x, y, size, side, direction, other) {
    if (!other) return false;
    return footprintsOverlap(
      footprintCellsAt(x, y, size, side, direction),
      footprintCellsAt(other.x | 0, other.y | 0, unitSize(other), other.side, other.direction)
    );
  }

  function alive(units) {
    return (units || []).filter(function (u) { return u && (u.hp | 0) > 0; });
  }

  /**
   * Turn order: sheet unit Mobility (ML + OP + supporter MOB%) + pilot Reaction.
   * High → low. Uses actor.mobility (combat sheet), not raw unitStats.
   */
  function unitOrderSpeed(u) {
    if (!u) return 0;
    return (u.mobility | 0) + (u.reaction | 0);
  }

  function actionOrder(units) {
    return alive(units).map(function (u, i) {
      return { u: u, i: i, key: unitOrderSpeed(u) };
    }).sort(function (a, b) {
      if (b.key !== a.key) return b.key - a.key;
      return a.i - b.i;
    }).map(function (row) { return row.u; });
  }

  /** Same sort as actionOrder, but keeps KO’d units (for the turn-order strip). */
  function displayOrder(units) {
    return (units || []).filter(Boolean).map(function (u, i) {
      return { u: u, i: i, key: unitOrderSpeed(u) };
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
   * MLS getWeaponRangeBonus — Range Boost skill + passive max-range +N
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
      m = t.match(/最大射程[^0-9]*?(\d+)|max(?:imum)?\s*range[^0-9]*?[+＋]?(\d+)|射程\s*[+＋](\d+)/i)
        /* EN LANG: "Melee Weapon Range +1" / "Special Weapon Range +1" / "… shooting range +1" */
        || t.match(/(?:Weapon|Melee|Special|Beam|Physical|Shooting|格闘|射撃|射擊)\s+(?:Weapon\s+)?(?:Max(?:imum)?\s+)?Range\s*[+＋](\d+)/i)
        || t.match(/(?:格闘|特殊)\s*(?:武装|武裝)?\s*(?:の)?(?:最大)?射程\s*[+＋]?(\d+)/i);
      if (!m) continue;
      if (!tensionOk(actor && actor.mp, t)) continue;
      /* Cond:Vigor Special Weapon Max Range — only special weapons. */
      if (/special\s+weapon|特殊武装|特殊武裝|特殊武器/i.test(t) && !weaponIsSpecial(weapon)) continue;
      /* Melee Weapon Range +N — only melee weapons. */
      if (/melee\s+weapon\s+range|格闘.*射程/i.test(t) && !weaponIsMelee(weapon)) continue;
      if (/HP(?:が)?満タン|HP\s*(?:at\s*)?full/i.test(t) && hpRatio < 0.999) continue;
      hpM = t.match(/HP(?:が)?(\d+)%以上|HP\s*(\d+)%\+/i);
      if (hpM && hpRatio * 100 < (parseInt(hpM[1] || hpM[2], 10) || 0)) continue;
      add = parseInt(m[1] || m[2] || m[3] || m[4] || m[5], 10);
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
   * MLS getReachableCells — 4-dir BFS. Allies are passable; enemies block.
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
      fp += (u.id || i) + ':' + (u.x | 0) + ',' + (u.y | 0) + ',' +
        (u.direction != null ? (u.direction | 0) : '') + ',' +
        ((u.hp | 0) > 0 ? 1 : 0) + ';';
    }
    cacheKey = (actor.id || '') + '@' + startX + ',' + startY + '/' + move + '/' +
      (bounds.minX | 0) + ',' + (bounds.maxX | 0) + ',' + (bounds.minY | 0) + ',' + (bounds.maxY | 0) +
      '/' + size + '/' + (actor.direction != null ? (actor.direction | 0) : '') + '/' + fp;
    if (_reachCacheKey === cacheKey && _reachCacheCells) return _reachCacheCells;

    function occupies(x, y) {
      var i;
      for (i = 0; i < (allUnits || []).length; i++) {
        u = allUnits[i];
        if (!u || (u.hp | 0) <= 0 || u === actor) continue;
        if (wouldOverlapUnit(x, y, size, actor.side, actor.direction, u)) return true;
      }
      return false;
    }

    function enemyBlocks(x, y) {
      var i;
      for (i = 0; i < (allUnits || []).length; i++) {
        u = allUnits[i];
        if (!u || (u.hp | 0) <= 0 || u === actor) continue;
        if (u.side === actor.side) continue;
        if (wouldOverlapUnit(x, y, size, actor.side, actor.direction, u)) return true;
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
        /* Bounds against real facing footprint (not AABB +y). */
        if (!footprintCellsAt(nx, ny, size, actor.side, actor.direction).every(function (c) {
          return c.x >= bounds.minX && c.x <= bounds.maxX &&
            c.y >= bounds.minY && c.y <= bounds.maxY;
        })) continue;
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
   * MLS getBestMoveDestination — cell within weapon minR..maxR of target,
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
   * Target priority among units this actor can still put in weapon range after moving:
   * lower absolute HP first (nicks / debuffs do not change the score).
   * Ties: closer → higher expected /cal damage → lower slot index.
   * Practice heuristic — not official Master League AI.
   */
  function compareEngageTargets(a, b) {
    var aHp = a.enemy.hp | 0;
    var bHp = b.enemy.hp | 0;
    if (aHp !== bHp) return aHp - bHp;
    if ((a.dist | 0) !== (b.dist | 0)) return (a.dist | 0) - (b.dist | 0);
    if ((a.expectedDmg | 0) !== (b.expectedDmg | 0)) return (b.expectedDmg | 0) - (a.expectedDmg | 0);
    return (a.enemy.n | 0) - (b.enemy.n | 0);
  }

  /**
   * MLS achievableTargets: enemies you can put in some weapon's range after moving.
   * Weapon = highest preview damage among those that reach; target = compareEngageTargets.
   */
  function pickEngage(attacker, enemies, allUnits, bounds, damageOf) {
    var move = Math.max(0, attacker.move | 0);
    var cells = getReachableCells(attacker, move, allUnits, bounds);
    var achievable = [];
    var e, bestWpn, bestDmg, can, ideal, i, cell, d, baseDist, mn, mx, mxEff, bonus, pDmg;

    alive(enemies).forEach(function (enemy) {
      bestWpn = null;
      bestDmg = -1;
      baseDist = distance(attacker, enemy);
      (attacker.weapons || []).forEach(function (weapon) {
        if (isMapWeapon(weapon)) return;
        mn = weapon.min_range != null ? weapon.min_range | 0 : 1;
        mx = weapon.max_range != null ? weapon.max_range | 0 : mn;
        bonus = getWeaponRangeBonus(attacker, weapon, false) | 0;
        mxEff = mx + bonus;
        can = false;
        ideal = Infinity;
        for (i = 0; i < cells.length; i++) {
          cell = cells[i];
          d = distance({ x: cell.x, y: cell.y, size: unitSize(attacker) }, enemy);
          if (d >= mn && d <= mxEff) {
            can = true;
            if (d < ideal) ideal = d;
          }
        }
        if (!can) return;
        if (baseDist >= mn && baseDist <= mxEff) ideal = baseDist;
        pDmg = typeof damageOf === 'function'
          ? Math.max(0, damageOf(attacker, enemy, weapon) | 0)
          : (weapon.power | 0);
        if (pDmg > bestDmg) {
          bestDmg = pDmg;
          bestWpn = weapon;
        }
      });
      if (bestWpn) {
        achievable.push({
          enemy: enemy,
          weapon: bestWpn,
          expectedDmg: bestDmg,
          dist: baseDist
        });
      }
    });

    if (!achievable.length) return null;
    achievable.sort(compareEngageTargets);
    e = achievable[0];
    mn = e.weapon.min_range != null ? e.weapon.min_range | 0 : 1;
    mx = e.weapon.max_range != null ? e.weapon.max_range | 0 : mn;
    /* Move destination must honor the same +range passives as weaponsInRange / getValidWeapons. */
    mx = mx + (getWeaponRangeBonus(attacker, e.weapon, false) | 0);
    return { target: e.enemy, weapon: e.weapon, minR: mn, maxR: mx, expectedDmg: e.expectedDmg };
  }

  function pickTarget(attacker, enemies) {
    var rows = [];
    alive(enemies).forEach(function (e) {
      var wpns = weaponsInRange(attacker, e);
      var bestWpn;
      var bestDmg = -1;
      var i;
      var p;
      if (!wpns.length) return;
      for (i = 0; i < wpns.length; i++) {
        p = wpns[i].power | 0;
        if (p > bestDmg) {
          bestDmg = p;
          bestWpn = wpns[i];
        }
      }
      rows.push({
        enemy: e,
        weapon: bestWpn,
        expectedDmg: bestDmg,
        dist: distance(attacker, e)
      });
    });
    if (!rows.length) return null;
    rows.sort(compareEngageTargets);
    return rows[0].enemy;
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
   * MLS isAbilityActive-lite for one detail row: empty conditions always on;
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
      /* “When piloting units from specified series” — Argi-class Guaranteed CS. */
      if (src === 'series' || typ === 'series') {
        if (name && series.indexOf(name) >= 0) return true;
        if (id && series.indexOf(id) >= 0) return true;
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
   * Pilot character type (LANG help) — not MS unit role.
   * role_id: 1 Attack · 2 Durability · 3 Support.
   */
  function pilotRoleKey(actor) {
    var ch = actor && actor.char;
    var id = String((ch && (ch.role_id != null ? ch.role_id : ch.roleId)) ||
      (actor && (actor.role_id != null ? actor.role_id : actor.roleId)) || '').trim();
    var name = String((ch && (ch.role || ch.type)) || (actor && actor.role) || '').toLowerCase();
    if (id === '3' || /support|支援/.test(name)) return 'support';
    if (id === '2' || /durability|defense|耐久/.test(name)) return 'durability';
    if (id === '1' || /attack|攻撃|攻擊/.test(name)) return 'attack';
    return '';
  }

  /** LANG: Support-type characters possess Support Attack (baseline 1 when kit text is silent). */
  function roleDefaultSupportAttack(actor) {
    return pilotRoleKey(actor) === 'support' ? 1 : 0;
  }

  /** LANG: Durability-type characters possess Support Defense (baseline 1 when kit text is silent). */
  function roleDefaultSupportDefend(actor) {
    return pilotRoleKey(actor) === 'durability' ? 1 : 0;
  }

  /**
   * MLS calcSupportDefendLimit — SUM every active 「支援防御」+N line (per turn stock).
   * Once-per-battle lines subtract battleSupportDefendedCount. Tension / detail
   * conditions are evaluated live (not the dossier conditionalPassiveActive toggle).
   * Floor at role baseline so Durability pilots match help/dossier when +N text is missing.
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
    return Math.max(count, roleDefaultSupportDefend(actor) | 0);
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
        /* MLS getGuardSupportDefendBonus — 「支援防御の範囲がN上昇」 etc. */
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

  /** Remaining SD uses this turn (MLS: calcSupportDefendLimit - usedSupportDefendCount). */
  function supportDefendRemaining(actor) {
    return Math.max(0, effectiveSupportDefendLimit(actor) - ((actor && actor.usedSupportDefendCount) | 0));
  }

  /** Remaining SA / support-counter uses this turn. */
  function supportAttackRemaining(actor) {
    return Math.max(0, effectiveSupportAttackLimit(actor) - ((actor && actor.usedSupportCount) | 0));
  }

  /**
   * LANG Terrain Capability row level: 3 ● · 2 ▲ · 1 -.
   * Season "Land" uses Ground/Land + Atmospheric (MLS getTerrainSuitability for 地上).
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
   * MLS guardCands: not self, remaining SD uses, Manhattan dist <= move + SD range bonus,
   * terrain-enterable cover cell (LANG), highest HP. Returns null if nobody covers.
   */
  function pickSupportDefender(target, allies) {
    var best = null;
    var maxHp = -1;
    if (!target) return null;
    alive(allies).forEach(function (a) {
      var limit, used, range;
      if (!a || a === target) return;
      /* Never cover the opposing force (ally must not S.Def for enemy, and vice versa). */
      if ((a.side || '') !== (target.side || '')) return;
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
      if ((a.side || '') !== (attacker.side || '')) return;
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
    var burstCost = 0;
    var boostCost = 0;
    ((charData && charData.skills) || []).forEach(function (s) {
      var key = skillKeyFromName(s && s.name);
      var cost = s && s.sp != null ? (s.sp | 0) : 0;
      var effect;
      if (!key) return;
      effect = Array.isArray(s.details)
        ? s.details.map(function (d) {
          return typeof d === 'string' ? d : ((d && d.text) || '');
        }).join(' ')
        : String(s.details || s.effect || '');
      list.push({
        key: key,
        name: s.name || key,
        sp: cost,
        icon: (s && (s.icon || s.icon_url || s.thum)) || '',
        effect: effect
      });
      if (cost > spMax) spMax = cost;
      if (key === 'attack_burst') burstCost = Math.max(burstCost, cost);
      if (key === 'shooting_boost' || key === 'melee_boost' || key === 'awaken_boost') {
        boostCost = Math.max(boostCost, cost);
      }
    });
    /*
     * SP pool: MaxSp is not on the browse payload. Floor so one action can fire the
     * usual damage pair (Attack Burst + Ranged/Melee/Awaken Boost) — e.g. V2AB Uso
     * Attack Burst 5 + Ranged Boost 7. Not a “save for turn 2” reserve.
     * (EN help: multiple different skills before you act; same effect cannot re-fire.)
     */
    return { list: list, sp: Math.max(spMax, burstCost + boostCost, 10) };
  }

  /** MP gained from an MP Up skill text (EN “Increase MP by 7.”). */
  function parseMpUpAmount(skill) {
    var blob = normalizeFullwidth(String((skill && (skill.effect || skill.name)) || ''));
    var m = blob.match(/[Ii]ncrease\s+(?:own\s+)?MP\s+by\s+(\d+)/i)
      || blob.match(/(?:自身の)?MP(?:が|を)\s*(\d+)\s*上昇/)
      || blob.match(/自身MP(?:增加|提升)(\d+)/)
      || blob.match(/MP\s*\+\s*(\d+)/);
    return m ? Math.max(1, parseInt(m[1], 10) || 0) : 3;
  }

  /** True when a non-MAP weapon is locked by Tension / consume-MP vs current MP. */
  function weaponsNeedMoreMp(unit) {
    var mp = (unit && unit.mp) | 0;
    var i, w, blob, m, cost, req;
    for (i = 0; i < ((unit && unit.weapons) || []).length; i++) {
      w = unit.weapons[i];
      if (!w || isMapWeapon(w)) continue;
      req = weaponMpRequirement(w);
      if (req > mp) return true;
      blob = normalizeFullwidth(weaponEffectBlob(w));
      m = blob.match(/Can be used when consuming\s*(\d+)\s*MP/i)
        || blob.match(/(\d+)\s*MP消費時に使用可能/)
        || blob.match(/消耗\s*(\d+)\s*MP時可使用/)
        || blob.match(/MP消費(\d+)|Consumes?\s*(\d+)\s*MP/i);
      cost = m ? (parseInt(m[1] || m[2] || m[3], 10) || 0) : 0;
      if (cost > mp) return true;
    }
    return false;
  }

  /** MLS / site: Chance Step uses (額外行動). Base 1; +1 ability → up to 2.
   * Auto-CS forces an existing budget slot without a KO (does not raise max).
   * Guaranteed CS +N is a real count increase (see checkAndAcquireUnconditionalCS). */
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
          if (isGuaranteedCsStockText(t) || isAutoCsAfterCombatText(t)) continue;
          if (/Chance\s*Step|チャンスステップ|額外行動|찬스 스텝/i.test(t) && /[+＋]\s*1|×\s*2|x2/i.test(t)) {
            n = 2;
          }
        }
      }
    });
    return n;
  }

  /** MLS predictCounter — an enemy can still hit us after we close. */
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
   * MLS / EN help evaluatePilotSkills:
   * Multiple different skills per action while SP lasts (same effect cannot re-fire).
   * Priority: High Speed, Range Boost, Repair, Force Guard, MP Up, bursts,
   * EN free, SD-count, Sway (only if a counter is possible), Crit Boost.
   * When a Tension/MP-gated weapon is locked, MP Up is tried first (Burning Max / consume).
   */
  function pickSkill(unit, enemies) {
    var kit, i, sk, canHit, maxHp, hp, sp, order, oi, key, used;
    if (!unit) return null;
    kit = unit.pilotSkills || { list: [] };
    sp = unit.currentSp != null ? (unit.currentSp | 0) : (unit.sp | 0);
    used = unit.usedSkillKeys || {};
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
    function tryKey(k) {
      var s = find(k);
      if (!s || used[k] || !afford(s)) return null;
      if ((k === 'high_speed' || k === 'range_boost') && canHit) return null;
      if (k === 'repair' && !(maxHp > 0 && hp * 2 < maxHp)) return null;
      /* MP Up while under Supercharged — needed for Tension Max / consume gates. */
      if (k === 'mp_up' && (unit.mp | 0) >= 12) return null;
      if (k === 'en_free' && unit.hasUsedFreeAmmoSkillInBattle) return null;
      if (k === 'sway' && !enemyCanCounter(unit, enemies)) return null;
      return s;
    }

    if (weaponsNeedMoreMp(unit)) {
      sk = tryKey('mp_up');
      if (sk) return sk;
    }

    order = [
      'high_speed', 'range_boost', 'repair', 'force_guard', 'mp_up',
      'attack_burst', 'shooting_boost', 'melee_boost', 'awaken_boost',
      'en_free', 'sd_plus', 'sway', 'crit_boost'
    ];
    for (oi = 0; oi < order.length; oi++) {
      key = order[oi];
      sk = tryKey(key);
      if (sk) return sk;
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
   * MLS evaluateUnitSkill timing:
   * first-strike / initial-null skills fire at combat start;
   * every other unit skill fires once before the move.
   * Numbers stay in /cal — this only decides when the skill turns on.
   */
  function planUnitSkill(actor, phase) {
    var skills, i, sk, blob, anyFirst, first, out, m, rMin, rMax, allyN;
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
      /* Extra allies besides self (Nu EX MultiTargetCount=1). */
      barrierAllyCount: 0,
      barrierRangeMin: 0,
      barrierRangeMax: 0,
      firstStrike: false,
      beamDr: 0,
      /* Any type-11 DTD (beam/phys/special) — arms 1-turn skill window. */
      skillDtd: 0,
      /* Type-14 Attack Burst — % damage dealt (1 turn); /cal reads via unitTurnBuffAtk. */
      dmgPct: 0
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
        /* Type 10 = flat MOV (V2 Assault Buster / High Speed +1). */
        if (typ === '10') out.move = Math.max(out.move, val);
        /* Type-11 DTD: arm 1-turn window; beam-tagged also feeds post-/cal beam DR. */
        if (typ === '11' && val > 0) {
          out.skillDtd = Math.max(out.skillDtd | 0, val);
          if (/beam|ビーム|光束|鐳射/i.test(blob) ||
              ((tr.active_weapon_attrs || []).some(function (a) {
                return /beam|ビーム|光束|鐳射/i.test(String(a));
              }))) {
            out.beamDr = Math.max(out.beamDr, val);
          }
        }
        /* Type 12 = MP on skill use only (never battle-start — see startingMpBonus). */
        if (typ === '12') out.mp = Math.max(out.mp, val);
        /* Type 14 = Attack Burst — Increase damage dealt by N% (1 turn). */
        if (typ === '14') out.dmgPct = Math.max(out.dmgPct, val);
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
      m = blob.match(/Increase\s+damage\s+dealt(?:\s+to\s+enemies)?\s+by\s+(\d+)\s*%/i)
        || blob.match(/与(?:える)?ダメージ(?:を)?(\d+)\s*%(?:アップ|上昇)/)
        || blob.match(/造成的?損傷(?:提高|增加)[^0-9]*(\d+)\s*%/);
      if (m) out.dmgPct = Math.max(out.dmgPct, parseInt(m[1], 10) || 0);
      m = blob.match(/最大HP\s*(\d+)\s*%|Max\s*HP[^0-9]{0,12}(\d+)\s*%/i);
      if (m && /バリア|barrier|屏障/i.test(blob)) {
        out.barrierPct = Math.max(out.barrierPct, parseInt(m[1] || m[2], 10) || 0);
      }
      m = blob.match(/ビーム[^%]{0,16}(\d+)\s*%|beam[^%]{0,24}(\d+)\s*%/i);
      if (m && /軽減|reduce\s+damage/i.test(blob)) {
        out.beamDr = Math.max(out.beamDr, parseInt(m[1] || m[2], 10) || 0);
        out.skillDtd = Math.max(out.skillDtd | 0, out.beamDr);
      }
      /* Master multi-target (preferred) + LANG “self and N ally” fallback. */
      if (out.barrierPct > 0) {
        rMin = sk.multi_target_range_min != null ? (sk.multi_target_range_min | 0) : out.barrierRangeMin;
        rMax = sk.multi_target_range_max != null ? (sk.multi_target_range_max | 0) : out.barrierRangeMax;
        allyN = sk.multi_target_count != null ? (sk.multi_target_count | 0) : out.barrierAllyCount;
        if (!(rMax > 0)) {
          m = blob.match(/range[^0-9]{0,6}(\d+)\s*[-–~〜]\s*(\d+)/i);
          if (m) { rMin = parseInt(m[1], 10) || 0; rMax = parseInt(m[2], 10) || 0; }
        }
        if (!(allyN > 0) && /self\s+and|自身と|自己與|自己与/i.test(blob)) {
          m = blob.match(/(\d+)\s*ally|味方\s*(\d+)|盟友\s*(\d+)|味方ユニット\s*(\d+)/i);
          if (m) allyN = parseInt(m[1] || m[2] || m[3] || m[4], 10) || 1;
          else allyN = 1;
        }
        if (rMax > 0) {
          out.barrierRangeMin = rMin | 0;
          out.barrierRangeMax = rMax | 0;
        }
        if (allyN > 0) out.barrierAllyCount = allyN | 0;
      }
    }
    /* Defaults when API multi-target fields are missing (stale process / old payload). */
    if (out.barrierPct > 0 && !(out.barrierRangeMax > 0)) {
      out.barrierRangeMin = 0;
      out.barrierRangeMax = 3;
    }
    if (out.barrierPct > 0 && !(out.barrierAllyCount > 0)) {
      for (i = 0; i < skills.length; i++) {
        if (/self\s+and|自身と|自己與|自己与/i.test(unitSkillText(skills[i]))) {
          out.barrierAllyCount = 1;
          break;
        }
      }
    }
    if (!(out.atkPct || out.defPct || out.mobPct || out.mp || out.move || out.barrierPct ||
        out.firstStrike || out.beamDr || out.skillDtd || out.dmgPct)) {
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

  /* ========== MLS battle-loop combat systems (executeAttack / runSimulation) ========== */

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
    /* Supercharged vigor / Supercharged EX — MP band ≥12 (EN often omits “EX”). */
    if (/超一撃|超一擊|Supercharged/i.test(t) && m < 12) return false;
    /* "Max or greater" / 超強気以上 — require High band (MP≥8), before soft High|Max matcher. */
    if (/(?:Vigor\s+is\s+[\"'「]?Max|Vigor[^\n]{0,24}Max[\"'」]?\s+or\s+greater|テンションが「?超強気|テンション「?超強気」?以上|戰意為「?超強勢|戰意「?超強勢」?以上|战意为「?超强势)/i.test(t) && m < 8) return false;
    if (/超強気|High\s*Vigor|超強勢/i.test(t) && !/超一撃|Supercharged|超一擊/i.test(t) && m < 8) return false;
    if (/強気以上|Vigor.*(High|Max)|強勢以上/i.test(t) && m < 4) return false;
    return true;
  }

  /** Official Guaranteed / 無条件 / 無條件 stock (+N, often once/battle). */
  function isGuaranteedCsStockText(t) {
    return /Guaranteed\s*Chance\s*Step|Guaranteed\s*Chance\s*\+|Unconditional\s*Chance\s*Step|無条件チャンスステップ|無條件額外行動|无条件额外行动/i.test(t || '');
  }

  /** Parse 「無条件チャンスステップ」+N / Guaranteed Chance Step +N time(s). Default 1. */
  function guaranteedCsCountIncrease(text) {
    var norm = normalizeFullwidth(text || '');
    var m = norm.match(/(?:Guaranteed\s*Chance(?:\s*Step)?|Unconditional\s*Chance\s*Step|無条件チャンスステップ|無條件額外行動|无条件额外行动)[^\d+＋]{0,12}[+＋]\s*(\d+)/i)
      || norm.match(/[+＋]\s*(\d+)\s*(?:time|回|次|회)/i);
    var n = m ? (parseInt(m[1], 10) || 0) : 1;
    return n < 1 ? 1 : n;
  }

  /**
   * Official Auto-Chance Step / オート / 自動 — end of combat without KO.
   * m_help: does NOT trigger after MAP Weapons.
   */
  function isAutoCsAfterCombatText(t) {
    return /Auto[- ]?Chance\s*Step|オートチャンスステップ|自動額外行動|regardless of whether or not enemies have been defeated|敵を撃破しなくても|即使未擊敗敵人|即使未击败敌人|적을\s*격파하지\s*않아도/i.test(t || '');
  }

  function weaponIsSpecial(weapon) {
    var t = String((weapon && weapon.raw && weapon.raw.weapon_type) || (weapon && weapon.weapon_type) || '');
    if (/特殊|special/i.test(t)) return true;
    /* Numeric type tables sometimes encode special as 3 / "Special". */
    if (/^3$/.test(t.trim())) return true;
    return false;
  }

  function weaponIsMelee(weapon) {
    var types, i, t, wt;
    types = weaponAtkTypeKeys(weapon);
    for (i = 0; i < types.length; i++) {
      t = String(types[i] || '').toLowerCase();
      if (/melee|格闘|格鬥|格斗/.test(t)) return true;
    }
    wt = String((weapon && weapon.raw && weapon.raw.weapon_type) || (weapon && weapon.weapon_type) || '');
    return /melee|格闘|格鬥|格斗/i.test(wt);
  }

  /**
   * MLS calcSupportLimit — SUM every active Support Attack/Counter +N line.
   * Do NOT use bare「支援」+N (that false-matches 支援防御). Do NOT cache via saLimit
   * (tension-gated EX +N must re-evaluate as MP rises).
   * Floor at role baseline so Support pilots match help/dossier when +N text is missing.
   */
  function supportAttackLimit(actor) {
    var count = 0;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var norm, m;
      if (detail && !detailConditionsMet(actor, detail)) return;
      norm = normalizeFullwidth(text);
      /* EN — also "Support Attack/Counter +1" (no spaces around /). */
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
    return Math.max(count, roleDefaultSupportAttack(actor) | 0);
  }

  /** LANG help: up to three allied units join SA or SC in a single combat. */
  var MAX_SUPPORT_PARTICIPANTS = 3;

  /**
   * MLS checkCounterSupportDefend — ability must explicitly allow SD vs counter.
   * Collapse newlines before matching: Fon Spaak EX splits
   * “with a counter,” / “execute Support Defense.” across lines (`.` does not match \\n).
   */
  function canCounterSupportDefend(actor) {
    var found = false;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var t;
      if (found) return;
      if (detail && !detailConditionsMet(actor, detail)) return;
      t = normalizeFullwidth(text).replace(/\s+/g, ' ');
      if (!/反撃に対して支援防御|反撃時支援防御|敵の反撃に対して支援防御|Counter[\s\S]*Support\s*Defense|Support\s*Defense[\s\S]*[Cc]ounter|支援防御[\s\S]*反撃|支援防禦[\s\S]*反擊|受到敵方反擊時[\s\S]*支援防禦|受到敌方反击时[\s\S]*支援防御/i.test(t)) return;
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
      if ((a.side || '') !== (actor.side || '')) return;
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
    var list, i, m, key, name;
    if (!actor || !actor.unit) return false;
    list = actor.unit.mechanisms;
    if (!Array.isArray(list)) {
      return /ShieldDefense|Shield\s*Defense|シールド防御|護盾防禦|防盾/i.test(
        String(actor.unit.mechanism || actor.unit.mechanisms || '')
      );
    }
    /* Prefer MechanismType key — do not match flavor text that merely says “shield”. */
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (!m) continue;
      if (typeof m === 'string') {
        if (/ShieldDefense|Shield\s*Defense|シールド防御|護盾防禦/i.test(m)) return true;
        continue;
      }
      key = String(m.mechanism_type_key || '');
      name = String(m.name || m.mechanism_type_label || '');
      if (key === 'ShieldDefense' || /Shield\s*Defense|シールド防御|護盾防禦/i.test(name)) return true;
    }
    return false;
  }

  /** MLS determineDefenseAction */
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
    /* Pilot Ranged/Melee Boost “reduce weapons EN consumption by N% (1 turn)”. */
    if ((actor.skillEnCostDownPct | 0) > 0) {
      mult -= Math.min(80, actor.skillEnCostDownPct | 0) / 100;
    }
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

  /**
   * Minimum MP band to *unlock* a weapon (Tension/Vigor gates only).
   * MP-consume costs are separate — see weaponMpCost (Affinity reductions apply there).
   * EN: "Can be used at Tension Max or greater."
   * JA: "テンションMax以上で使用可能。" · TW/HK: "戰意Max以上時可使用。"
   */
  function weaponMpRequirement(weapon) {
    var blob = normalizeFullwidth(weaponEffectBlob(weapon) + ' ' + ((weapon.usage_restrictions || []).join(' ')));
    var req = 0;
    var m;
    /* Supercharged / 超一撃 / 超一擊 — MP ≥ 12. */
    if (/超一撃|Supercharged(?:\s*EX)?|超一擊/i.test(blob) &&
        /以上|or\s+greater|以上で|以上時|以上时/i.test(blob)) {
      req = Math.max(req, 12);
    }
    /* Max / 超強気 / 超強勢 / Tension Max — MP ≥ 8. */
    if (/(?:Tension|Vigor)\s*Max|テンション\s*Max|戰意\s*Max|超強気|超強勢/i.test(blob) &&
        /以上|or\s+greater|以上で|以上時|以上时|Can be used/i.test(blob)) {
      req = Math.max(req, 8);
    } else if (/超強気以上|超強勢以上|Vigor.*Max|Max\s+or\s+greater/i.test(blob)) {
      req = Math.max(req, 8);
    }
    /* High / 強気 / 強勢 — MP ≥ 4 (only when not already Max+). */
    if (req < 8 && /(?:Tension|Vigor)\s*High|テンション\s*High|戰意\s*High|強気以上|強勢以上|High\s+or\s+greater/i.test(blob)) {
      req = Math.max(req, 4);
    }
    m = blob.match(/MP(?:が)?(\d+)以上|MP\s*(\d+)\+/i);
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

  /** MLS getValidWeapons — EN / ammo / range(+bonus) / MP / move-before. targetDist=null → MAP pass. */
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
      /* Need enough MP for the Tension gate and for the consume cost (after Affinity −N). */
      if ((actor.mp | 0) < reqMp) return false;
      if ((actor.mp | 0) < weaponMpCost(actor, w, !!isSupport)) return false;
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
        if (!d) return;
        if (kind === 'hit' && (d.type === '命中率' || d.type === 'acc_dn')) total -= d.value | 0;
        if (kind === 'eva' && (d.type === '回避率' || d.type === 'eva_dn')) {
          total += d.isUp ? (d.value | 0) : -(d.value | 0);
        }
      });
    }
    return total;
  }

  /**
   * Unit ability Parry (e.g. ability 1017103 / unit 1705002050).
   * LANG: when Vigor ≥ Max, N% chance to evade listed attr+type weapons, up to K times/turn.
   * Help: blocked by Absolute Hit / Lock On / MAP.
   */
  function parseParryKit(actor) {
    var bags, i, t, name, chance, maxUses, vigorMin, pairs, m, icon;
    var hasPhysMel, hasBeamMel, hasPhysRng, hasBeamRng, hasPhys, hasBeam, hasMel, hasRng;
    var abilityLists, li, list;
    bags = [];
    icon = '';
    /* Accept battle actor ({ unit }) or raw unit dossier (abilities on self). */
    abilityLists = [];
    if (actor && actor.unit && Array.isArray(actor.unit.abilities)) abilityLists.push(actor.unit.abilities);
    if (actor && Array.isArray(actor.abilities)) abilityLists.push(actor.abilities);
    for (li = 0; li < abilityLists.length; li++) {
      list = abilityLists[li];
      list.forEach(function (ab) {
        var texts = [];
        var det, j, nm, rid;
        nm = String((ab && (ab.name || ab.title)) || '');
        rid = String((ab && (ab.resource_id || ab.ResourceId || ab.icon || ab.image)) || '');
        if (Array.isArray(ab && ab.details)) {
          for (j = 0; j < ab.details.length; j++) {
            det = ab.details[j];
            if (typeof det === 'string') texts.push(det);
            else if (det && det.text) texts.push(String(det.text));
          }
        } else if (ab && ab.effect) texts.push(String(ab.effect));
        else if (ab && ab.desc) texts.push(String(ab.desc));
        texts.forEach(function (raw) {
          bags.push({ name: nm, text: String(raw || ''), icon: rid });
        });
        if (!texts.length && /Parry|パリィ|格擋|格挡/i.test(nm)) {
          bags.push({ name: nm, text: nm, icon: rid });
        }
      });
    }
    chance = 0;
    maxUses = 0;
    vigorMin = '';
    pairs = [];
    for (i = 0; i < bags.length; i++) {
      name = bags[i].name || '';
      t = normalizeFullwidth(bags[i].text || '');
      if (!/Parry|パリィ|格擋|格挡/i.test(name + ' ' + t)) continue;
      m = t.match(/(\d+)\s*%/);
      if (m) chance = Math.max(chance, parseInt(m[1], 10) || 0);
      m = t.match(/Up to\s+(\d+)\s*time|(\d+)\s*time\(s\)\s*per turn|1ターン(\d+)回|1回合最多(\d+)次|每回合最多(\d+)次/i);
      if (m) maxUses = Math.max(maxUses, parseInt(m[1] || m[2] || m[3] || m[4] || m[5], 10) || 0);
      if (/Supercharged|超一撃|超一擊/i.test(t) && /or\s+(?:greater|higher|above)|以上/i.test(t)) vigorMin = 'super';
      else if (/["“]Max["”]|「超強気」|「超強勢」|Vigor is\s*["']?Max/i.test(t)) vigorMin = vigorMin || 'max';
      else if (/["“]High["”]|「強気」|「強勢」/i.test(t)) vigorMin = vigorMin || 'high';
      hasPhysMel = /Physical\s*Melee|物理格闘|物理格鬥|物理格斗/i.test(t);
      hasBeamMel = /Beam\s*Melee|ビーム格闘|光束格鬥|鐳射格鬥|光束格斗|镭射格斗/i.test(t);
      hasPhysRng = /Physical\s*Ranged|物理射撃|物理射擊|物理射击/i.test(t);
      hasBeamRng = /Beam\s*Ranged|ビーム射撃|光束射擊|鐳射射擊/i.test(t);
      /* Fallback lists that only say attr / type nouns separately. */
      hasPhys = /Physical|物理/.test(t);
      hasBeam = /Beam|ビーム|光束|鐳射|镭射/.test(t);
      hasMel = /Melee|格闘|格鬥|格斗/.test(t);
      hasRng = /Ranged|射撃|射擊|射击/.test(t);
      if (hasPhysMel) pairs.push({ attr: 'physical', type: 'melee' });
      if (hasBeamMel) pairs.push({ attr: 'beam', type: 'melee' });
      if (hasPhysRng) pairs.push({ attr: 'physical', type: 'ranged' });
      if (hasBeamRng) pairs.push({ attr: 'beam', type: 'ranged' });
      if (!pairs.length && hasPhys && hasMel) pairs.push({ attr: 'physical', type: 'melee' });
      if (!pairs.length && hasBeam && hasMel) pairs.push({ attr: 'beam', type: 'melee' });
      if (bags[i].icon) icon = bags[i].icon;
    }
    if (!chance && !maxUses) return null;
    if (!chance) chance = 40;
    if (!maxUses) maxUses = 3;
    if (!vigorMin) vigorMin = 'max';
    if (!pairs.length) {
      pairs = [
        { attr: 'physical', type: 'melee' },
        { attr: 'beam', type: 'melee' },
        { attr: 'physical', type: 'ranged' }
      ];
    }
    /* Dedupe pairs */
    pairs = pairs.filter(function (p, idx, arr) {
      return arr.findIndex(function (q) { return q.attr === p.attr && q.type === p.type; }) === idx;
    });
    if (!icon) icon = 'trait_11760100';
    return { chance: chance, maxUses: maxUses, vigorMin: vigorMin, pairs: pairs, icon: icon };
  }

  function parryVigorOk(actor, vigorMin) {
    var mp = actor && actor.mp | 0;
    var need = String(vigorMin || 'max');
    if (need === 'super') return mp >= 12;
    if (need === 'max') return mp >= 8;
    if (need === 'high') return mp >= 4;
    return true;
  }

  function weaponMatchesParryPairs(weapon, pairs) {
    var attrs, types, i, p, aOk, tOk, ti;
    if (!weapon || !pairs || !pairs.length) return false;
    attrs = weaponAttrKeys(weapon);
    types = weaponAtkTypeKeys(weapon).map(function (x) {
      x = String(x || '').toLowerCase();
      if (/melee|格闘|格鬥|格斗/.test(x)) return 'melee';
      if (/ranged|射撃|射擊|射击|shoot/.test(x)) return 'ranged';
      if (/awaken|覚醒|覺醒|觉醒/.test(x)) return 'awaken';
      return x;
    });
    for (i = 0; i < pairs.length; i++) {
      p = pairs[i];
      aOk = attrs.indexOf(p.attr) >= 0;
      tOk = false;
      for (ti = 0; ti < types.length; ti++) {
        if (types[ti] === p.type) { tOk = true; break; }
      }
      if (aOk && tOk) return true;
    }
    return false;
  }

  function attackerHasLockOn(attacker) {
    if (!attacker || !attacker.activeSkills) return false;
    return attacker.activeSkills.some(function (s) {
      return s && /Lock\s*On|ロックオン|鎖定|锁定/i.test(String(s.name || ''));
    });
  }

  function tryParry(attacker, defender, weapon) {
    var kit, left, roll;
    if (!defender || !weapon) return false;
    if (isMapWeapon(weapon)) return false;
    if (isAbsoluteHitWeapon(weapon)) return false;
    if (attackerHasLockOn(attacker)) return false;
    kit = defender.parryKit || parseParryKit(defender);
    if (!kit) return false;
    defender.parryKit = kit;
    if (!parryVigorOk(defender, kit.vigorMin)) return false;
    if (!weaponMatchesParryPairs(weapon, kit.pairs)) return false;
    left = (kit.maxUses | 0) - (defender.usedParryCount | 0);
    if (left <= 0) return false;
    roll = nextRandom() * 100;
    if (roll > (kit.chance | 0)) return false;
    defender.usedParryCount = (defender.usedParryCount | 0) + 1;
    defender._lastMissReason = 'Parry';
    defender._parryJustTriggered = true;
    return true;
  }

  /**
   * MLS checkHit — absolute hit; Parry; sway; evade formula when defenseAction==='evade';
   * Otherwise always hits (defend / none / shield).
   */
  function checkHit(attacker, defender, weapon, defenseAction, isDefenderSupportDefend) {
    var mobAtk, mobDef, plAtk, defReact, x, hitRate, blob, m, isEx;
    var charAtk, charDef, hasSway;
    if (attacker) attacker._lastMissReason = '';
    if (defender) {
      defender._lastMissReason = '';
      defender._parryJustTriggered = false;
    }
    if (isAbsoluteHitWeapon(weapon)) return true;
    /* LANG Parry — ability evade (not Defend action). Blocked by Abs Hit / Lock On / MAP. */
    if (tryParry(attacker, defender, weapon)) return false;
    /* MLS: Sway dodges only the original target, never a Support Defense cover, never vs Absolute Hit. */
    hasSway = defender && defender.activeSkills && defender.activeSkills.some(function (s) {
      return s && /Sway|スウェー/i.test(String(s.name || ''));
    });
    if (hasSway && !isDefenderSupportDefend) {
      defender.usedSwayInCombat = true;
      defender._lastMissReason = 'Sway';
      return false;
    }
    if (defender && defender.hasEvadeWay && !defender.usedEvadeWay) {
      defender.usedEvadeWay = true;
      defender._lastMissReason = 'Evade Way';
      return false;
    }
    if (defenseAction !== 'evade') return true;

    mobAtk = attacker.mobility | 0;
    mobDef = defender.mobility | 0;
    /* Inflict Mobility Down % on the defender. */
    if (defender && defender.debuffs) {
      defender.debuffs.forEach(function (d) {
        if (d && d.type === 'mob_dn' && (d.value | 0) > 0) {
          mobDef = Math.max(0, Math.floor(mobDef * (100 - (d.value | 0)) / 100));
        }
      });
    }
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
    if ((nextRandom() * 100) <= hitRate) return true;
    if (defender) {
      defender._lastMissReason = 'Evade ~' + Math.round(hitRate) + '%';
    }
    return false;
  }

  /** MLS calculateCriticalRate — weapon base + ability / OP / SD-tag lines. */
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

  /**
   * MLS checkAndAcquireUnconditionalCS — Guaranteed/Unconditional CS (once/battle).
   * EN: Guaranteed Chance Step · JA: 無条件チャンスステップ · TW/HK: 無條件額外行動.
   * Respects unit-tag / unit-id conditions + Vigor gates (e.g. Uso Supercharged + League Militaire).
   * Official ability text: 「+N time(s)」 / 「+N回」 is a real Chance Step count increase
   * (*Any count increase … will remain until used* / 増えた回数分は使用するまで消費されません).
   * Acquire: bump chanceStepsLeft by N and bank unconditionalCSStock so end-of-action can
   * fire without a KO. Firing still spends chanceStepsLeft (the raised budget).
   * Auto-CS is different — it only forces an existing slot and must not use this path.
   */
  function checkAndAcquireUnconditionalCS(actor) {
    var acquired = false;
    if (!actor || actor.hasAcquiredUnconditionalCS) return false;
    if (actor.hp != null && (actor.hp | 0) <= 0) return false;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var norm, add;
      if (acquired) return;
      if (detail && !detailConditionsMet(actor, detail)) return;
      norm = normalizeFullwidth(text);
      if (!isGuaranteedCsStockText(norm)) return;
      /* Skip Auto-Chance (“regardless of defeat”) lines — those are not once/battle stock. */
      if (isAutoCsAfterCombatText(norm) && !isGuaranteedCsStockText(norm)) return;
      if (!tensionOk(actor.mp, norm)) return;
      add = guaranteedCsCountIncrease(norm);
      acquired = true;
      actor.hasAcquiredUnconditionalCS = true;
      actor.unconditionalCSStock = (actor.unconditionalCSStock | 0) + add;
      /* Count increase remains until used — raise the live Bonus Action budget. */
      actor.chanceStepsLeft = (actor.chanceStepsLeft | 0) + add;
    });
    return acquired;
  }

  /**
   * Auto-Chance Step charges from ability text (“1 time(s)” / 1回 / 1次).
   * These are NOT infinite — they spend from the unit’s Chance Step budget
   * (chanceCount ≤ 2) and only fire without a KO that many times per action.
   */
  function autoCsTimesAvailable(actor) {
    var total = 0;
    if (!actor) return 0;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var norm, m, n;
      if (detail && !detailConditionsMet(actor, detail)) return;
      norm = normalizeFullwidth(text);
      if (!isAutoCsAfterCombatText(norm)) return;
      if (isGuaranteedCsStockText(norm)) return;
      if (!tensionOk(actor.mp, norm)) return;
      m = norm.match(/(?:trigger|発生|發動|발동)[^\d]{0,24}(\d+)\s*(?:time|回|次|회)/i)
        || norm.match(/(\d+)\s*(?:time\s*\(?s\)?|回|次|회)/i);
      n = m ? (parseInt(m[1], 10) || 0) : 1;
      if (n < 1) n = 1;
      total += n;
    });
    return total;
  }

  /**
   * Auto-Chance Step after this combat with no kill required (survive / revive OK).
   * Official help: does not trigger when using MAP Weapons.
   * Requires remaining autoCsLeft (set each action from autoCsTimesAvailable).
   */
  function grantsAutoCsAfterCombat(actor) {
    if (!actor || (actor.hp != null && (actor.hp | 0) <= 0)) return false;
    if ((actor.autoCsLeft | 0) <= 0) return false;
    return autoCsTimesAvailable(actor) > 0;
  }

  /** @deprecated use grantsAutoCsAfterCombat */
  function grantsGuaranteedCsAfterCombat(actor) {
    return grantsAutoCsAfterCombat(actor);
  }

  /** Localized CS labels from official m_help titles. */
  function chanceStepLabels(lang) {
    var L = String(lang || 'EN').toUpperCase();
    if (L === 'JA' || L === 'JP') {
      return { cs: 'チャンスステップ', auto: 'オートチャンスステップ', guaranteed: '無条件チャンスステップ' };
    }
    if (L === 'TW' || L === 'HK') {
      return { cs: '額外行動', auto: '自動額外行動', guaranteed: '無條件額外行動' };
    }
    return { cs: 'Chance Step', auto: 'Auto-Chance Step', guaranteed: 'Guaranteed Chance Step' };
  }

  /**
   * World cells for MAP weapon from master map_coords + facing.
   * 2×2 kits: visual footprint grows −y from the placement anchor (see footprintCellsAt),
   * while facing-right (dir 1) MLS mapping sends local +x → +y. Mirror that axis for
   * large units so the overlay starts on the drawn body (e.g. Neue Ziel EX → cells
   * beside the portrait, not one tile above).
   */
  function mapWeaponWorldCells(actor, weapon) {
    var dir = actor.direction != null ? (actor.direction | 0) : (actor.side === 'ally' ? 3 : 1);
    var ax = actor.x | 0;
    var ay = actor.y | 0;
    var large = unitSize(actor) > 1;
    var coords = (weapon.map_coords || (weapon.raw && weapon.raw.map_coords) || []);
    return coords.map(function (c) {
      var lx = c.x | 0;
      var ly = c.y | 0;
      if (dir === 1) return { x: ax + ly, y: large ? (ay - lx) : (ay + lx) };
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

  /** MAP hit test: MLS uses the unit’s placement anchor, not any overlapping footprint cell. */
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

  /** MapWeaponRangeTypeIndex 2 = designate impact tiles (not a fixed shooter-relative AoE). */
  function isImpactMapWeapon(w) {
    var mrt = String((w && (w.map_range_type != null ? w.map_range_type
      : (w.raw && w.raw.map_range_type))) || '0');
    if (mrt === '2') return true;
    if (mapImpactSelectCount(w) > 0) return true;
    return false;
  }

  /**
   * Dash / Moving-Attack MAP (MapWeaponRangeTypeIndex 4, e.g. V2AB Wings of Light / 光之翼).
   * Fires from the start tile; unit lands at the far end of shooting_coords after the attack.
   */
  function isDashMapWeapon(w) {
    var mrt, raw;
    if (!w) return false;
    raw = w.raw || w;
    if (w.is_dash || raw.is_dash || w.map_dash_dual_wide || raw.map_dash_dual_wide) return true;
    mrt = String(w.map_range_type != null ? w.map_range_type
      : (raw.map_range_type != null ? raw.map_range_type : '0'));
    return mrt === '4';
  }

  /** Local → world using the same facing basis as mapWeaponWorldCells. */
  function mapLocalToWorld(actor, lx, ly) {
    var dir = actor.direction != null ? (actor.direction | 0) : (actor.side === 'ally' ? 3 : 1);
    var ax = actor.x | 0;
    var ay = actor.y | 0;
    var large = unitSize(actor) > 1;
    if (dir === 1) return { x: ax + (ly | 0), y: large ? (ay - (lx | 0)) : (ay + (lx | 0)) };
    if (dir === 3) return { x: ax - (ly | 0), y: ay - (lx | 0) };
    if (dir === 2) return { x: ax + (lx | 0), y: ay + (ly | 0) };
    return { x: ax - (lx | 0), y: ay - (ly | 0) };
  }

  /** Shooting-path locals farthest from origin (dash land candidates, near→far). */
  function mapDashPathLocals(weapon) {
    var sc = (weapon && (weapon.shooting_coords || (weapon.raw && weapon.raw.shooting_coords))) || [];
    var ends = (weapon && (weapon.map_dash_dual_end_coords ||
      (weapon.raw && weapon.raw.map_dash_dual_end_coords))) || [];
    var list = (ends.length ? ends : sc).slice();
    list.sort(function (a, b) {
      var da = Math.abs(a.x | 0) + Math.abs(a.y | 0);
      var db = Math.abs(b.x | 0) + Math.abs(b.y | 0);
      return da - db;
    });
    return list;
  }

  /**
   * Where a dash MAP leaves the unit after firing (far end of shooting path).
   * Walks back toward the origin if the preferred land tile is out of bounds / occupied.
   */
  function resolveDashLandCell(actor, weapon, allUnits, bounds) {
    var locals, i, loc, world, size, ok, u, j;
    if (!actor || !isDashMapWeapon(weapon)) return null;
    locals = mapDashPathLocals(weapon);
    if (!locals.length) return null;
    size = unitSize(actor);
    for (i = locals.length - 1; i >= 0; i--) {
      loc = locals[i];
      world = mapLocalToWorld(actor, loc.x | 0, loc.y | 0);
      ok = footprintCellsAt(world.x, world.y, size, actor.side, actor.direction).every(function (c) {
        return c.x >= (bounds.minX | 0) && c.x <= (bounds.maxX | 0) &&
          c.y >= (bounds.minY | 0) && c.y <= (bounds.maxY | 0);
      });
      if (!ok) continue;
      for (j = 0; j < (allUnits || []).length; j++) {
        u = allUnits[j];
        if (!u || (u.hp | 0) <= 0 || u === actor) continue;
        if (wouldOverlapUnit(world.x, world.y, size, actor.side, actor.direction, u)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      if ((world.x | 0) === (actor.x | 0) && (world.y | 0) === (actor.y | 0)) return null;
      return { x: world.x | 0, y: world.y | 0 };
    }
    return null;
  }

  /** “Can designate up to N spots” / MapWeaponImpactPointMaxSelectCount. */
  function mapImpactSelectCount(w) {
    var n, m, blob, raw;
    raw = w && w.raw ? w.raw : w;
    n = (w && w.map_impact_point_max_select_count) | 0;
    if (n <= 0 && raw) n = raw.map_impact_point_max_select_count | 0;
    if (n > 0) return n;
    blob = normalizeFullwidth(weaponEffectBlob(w) + ' ' +
      ((w && w.usage_restrictions) || (raw && raw.usage_restrictions) || []).join(' '));
    m = blob.match(/(?:選択地点|ターゲット|designate|spots?).*?(\d+)/i);
    return m ? (parseInt(m[1], 10) || 0) : 0;
  }

  /**
   * After-move impact MAP: stand where the engage target is in range and as many
   * other foes as possible also fall in minR..maxR (pick off N spots).
   */
  function getBestImpactMapDestination(actor, target, foes, maxMove, minR, maxR, allUnits, bounds) {
    var size = unitSize(actor);
    var start = { x: actor.x | 0, y: actor.y | 0, size: size };
    var reachable, i, cell, d, score, inCount, best, pos;
    var livingFoes = alive(foes);

    function countInRange(posU) {
      var n = 0;
      var j, e, ed;
      for (j = 0; j < livingFoes.length; j++) {
        e = livingFoes[j];
        ed = distance(posU, e);
        if (ed >= minR && ed <= maxR) n += 1;
      }
      return n;
    }

    reachable = getReachableCells(actor, maxMove, allUnits, bounds);
    best = null;
    d = distance(start, target);
    if (d >= minR && d <= maxR) {
      inCount = countInRange(start);
      best = { x: start.x, y: start.y, moved: false, inCount: inCount, score: inCount * 1000 };
    }
    for (i = 0; i < reachable.length; i++) {
      cell = reachable[i];
      pos = { x: cell.x | 0, y: cell.y | 0, size: size };
      d = distance(pos, target);
      if (d < minR || d > maxR) continue;
      inCount = countInRange(pos);
      score = inCount * 1000 - (cell.cost | 0);
      if (!best || score > best.score) {
        best = {
          x: pos.x,
          y: pos.y,
          moved: pos.x !== start.x || pos.y !== start.y,
          inCount: inCount,
          score: score
        };
      }
    }
    return best;
  }

  /** Effect cells for one designated impact tile (map_coords are impact-relative). */
  function impactMapEffectCells(impactUnit, weapon, facingSide) {
    var pivot = {
      x: impactUnit.x | 0,
      y: impactUnit.y | 0,
      size: 1,
      side: facingSide,
      direction: facingSide === 'ally' ? 3 : 1
    };
    var cells = mapWeaponWorldCells(pivot, weapon);
    if (cells.length) return cells;
    return [{ x: pivot.x, y: pivot.y }];
  }

  /**
   * Non-MAP (EX) kill planning vs AI Defend ×0.8 / Shield ×0.6 / Evade.
   * MAP never offers that menu — plan MAP KO with raw damageOf only.
   * Lethal EX that forces Evade still counts as “prefer EX” (skip MAP).
   */
  function damageAfterAiDefense(actor, defender, weapon, damageOf) {
    var raw;
    var act;
    var withFlags;
    if (!defender || !weapon) return { dmg: 0, act: 'none' };
    raw = typeof damageOf === 'function'
      ? (damageOf(actor, defender, weapon) | 0)
      : (weapon.power | 0);
    if (raw <= 0) return { dmg: 0, act: 'none' };
    act = determineDefenseAction(defender, raw, false, false);
    if (act === 'evade') return { dmg: 0, act: 'evade', raw: raw };
    if (act === 'defend' || act === 'shield') {
      if (typeof damageOf === 'function') {
        withFlags = damageOf(actor, defender, weapon, {
          defending: true,
          shield: act === 'shield'
        });
        if (withFlags != null && isFinite(withFlags)) {
          return { dmg: withFlags | 0, act: act, raw: raw };
        }
      }
      return {
        dmg: Math.floor(raw * (act === 'shield' ? 0.6 : 0.8)),
        act: act,
        raw: raw
      };
    }
    return { dmg: raw, act: 'none', raw: raw };
  }

  function expectedDamageWithAiDefense(actor, defender, weapon, damageOf) {
    return damageAfterAiDefense(actor, defender, weapon, damageOf).dmg | 0;
  }

  /** Guaranteed KO through Defend/Shield, or lethal→Evade (EX-gate). */
  function killsUnderAiDefense(actor, defender, weapon, damageOf, forExGate) {
    var info = damageAfterAiDefense(actor, defender, weapon, damageOf);
    if (info.act === 'evade') return !!forExGate;
    return ((defender.hp | 0) - (info.dmg | 0)) <= 0;
  }

  function rawWeaponDamage(actor, defender, weapon, damageOf) {
    if (!weapon) return 0;
    return typeof damageOf === 'function'
      ? (damageOf(actor, defender, weapon) | 0)
      : (weapon.power | 0);
  }

  /** True when best non-MAP (current tile or after a normal move) finishes engage. */
  function nonMapKillsEngage(actor, target, allUnits, bounds, damageOf) {
    var nonMap;
    var probe;
    var list;
    var i;
    var wpn;
    var wi;
    var w;
    var minR;
    var maxR;
    var dest;
    var movedProbe;
    if (!actor || !target || (target.hp | 0) <= 0) return false;
    nonMap = (actor.weapons || []).filter(function (x) { return !isMapWeapon(x); });
    if (!nonMap.length) return false;

    function anyLethalFrom(fromPos) {
      list = weaponsInRange(
        {
          weapons: nonMap,
          x: fromPos.x | 0,
          y: fromPos.y | 0,
          size: unitSize(actor),
          side: actor.side
        },
        target
      );
      for (i = 0; i < list.length; i++) {
        wpn = list[i];
        if (killsUnderAiDefense(actor, target, wpn, damageOf, true)) return true;
      }
      return false;
    }

    probe = { x: actor.x | 0, y: actor.y | 0 };
    if (anyLethalFrom(probe)) return true;

    minR = 99;
    maxR = 0;
    for (wi = 0; wi < nonMap.length; wi++) {
      w = nonMap[wi];
      if (isMoveBeforeOnly(w) && actorHasMoved(actor)) continue;
      minR = Math.min(minR, w.min_range != null ? w.min_range | 0 : 1);
      maxR = Math.max(maxR, w.max_range != null ? w.max_range | 0 : 5);
    }
    if (maxR < minR || maxR <= 0) return false;
    dest = getBestMoveDestination(actor, target, actor.move | 0, minR, maxR, allUnits, bounds);
    if (!dest || !dest.moved) return false;
    movedProbe = { x: dest.x | 0, y: dest.y | 0 };
    return anyLethalFrom(movedProbe);
  }

  /**
   * MLS MAP interrupt (EX-first — MAP is rare in live ML):
   *   1. Prefer EX / highest non-MAP first — never open with MAP when that shot
   *      (from current tile or after a normal move) kills the engage target under
   *      AI Defend/Shield (even if MAP would multi-kill).
   *   2. Only then use MAP when ALL of:
   *        - engage survives best non-MAP
   *        - MAP shape hits 2+ living enemies including the engage target
   *        - raw MAP damage kills that engage target (Defend/Shield never apply to MAP)
   *      (No chip-MAP; killing only a side foe is not enough.)
   * Dash MAP (type 4, e.g. V2AB Wings of Light / 光之翼): fire from the current
   * tile (no pre-move); land at `dashTo` after hits resolve.
   */
  function evaluateMapWeapon(actor, target, foes, allUnits, bounds, damageOf) {
    var candidates = getValidWeapons(actor, null, false).filter(isMapWeapon);
    var best = null;
    var ci, wpn, free, cost, canFire, rawDist, mn, mx, needMove, simPos;
    var cells, inArea, maxSel, minNeed, mapKills, totalDmg, i, mt, mDmg;
    var better, mapDmgOnEngage, engageKilled;
    var impactMode, isDash, dashTo, dest, picked, key, seen, cellList, j, ec;
    var fireActor;

    /* Gate: if EX/best normal KO's engage (here or after move), skip all MAP. */
    if (nonMapKillsEngage(actor, target, allUnits, bounds, damageOf)) return null;

    for (ci = 0; ci < candidates.length; ci++) {
      wpn = candidates[ci];
      free = canUseFreeAmmoSkill(actor);
      cost = getEffectiveEnCost(actor, wpn, false);
      canFire = ((wpn.ammo | 0) > 0 && (actor.currentEn | 0) >= cost) || free;
      if (!canFire) continue;
      if (isMoveBeforeOnly(wpn) && actorHasMoved(actor)) continue;

      mn = wpn.min_range != null ? wpn.min_range | 0 : 1;
      mx = wpn.max_range != null ? wpn.max_range | 0 : 5;
      maxSel = mapImpactSelectCount(wpn);
      impactMode = isImpactMapWeapon(wpn);
      isDash = isDashMapWeapon(wpn);
      dashTo = null;
      rawDist = distance(actor, target);
      needMove = !isDash && (rawDist > mx || rawDist < mn);
      if (isMoveBeforeOnly(wpn) && needMove) continue;

      simPos = {
        x: actor.x | 0, y: actor.y | 0, size: unitSize(actor),
        side: actor.side, direction: actor.direction
      };
      /*
       * Dash MAP: attack IS the path — fire from the current tile only.
       * Impact multi-spot (after-move): even if already in range of the engage
       * target, step up when that puts a 2nd designate in range.
       */
      if (isDash) {
        needMove = false;
      } else if (impactMode && !isMoveBeforeOnly(wpn) && maxSel >= 2) {
        dest = getBestImpactMapDestination(actor, target, foes, actor.move | 0, mn, mx, allUnits, bounds);
        if (dest && distance({ x: dest.x, y: dest.y, size: simPos.size }, target) >= mn &&
            distance({ x: dest.x, y: dest.y, size: simPos.size }, target) <= mx) {
          var stayCount = 0;
          alive(foes).forEach(function (e) {
            var ed = distance(simPos, e);
            if (ed >= mn && ed <= mx) stayCount += 1;
          });
          if ((dest.inCount | 0) > stayCount || needMove) {
            simPos.x = dest.x;
            simPos.y = dest.y;
            needMove = !!(dest.moved);
          }
        } else if (needMove) {
          continue;
        }
      } else if (needMove) {
        dest = getBestMoveDestination(actor, target, actor.move | 0, mn, mx, allUnits, bounds);
        if (!dest) continue;
        simPos.x = dest.x;
        simPos.y = dest.y;
        needMove = !!(dest.moved);
      }
      if (!isDash && (distance(simPos, target) < mn || distance(simPos, target) > mx)) continue;

      if (impactMode) {
        /*
         * Type 2: pick up to N enemies in weapon range; effect pattern sits on each
         * impact (map_coords often just {0,0} = that tile). After-move kits (Altron /
         * Strike Noir EX) walk forward then snipe 2 spots.
         */
        inArea = alive(foes).filter(function (e) {
          var ed = distance(simPos, e);
          return ed >= mn && ed <= mx;
        });
        if (!inArea.some(function (e) { return e === target; })) continue;
        picked = inArea.slice().sort(function (a, b) {
          if (a === target && b !== target) return -1;
          if (b === target && a !== target) return 1;
          return (a.hp | 0) - (b.hp | 0);
        });
        if (maxSel > 0) picked = picked.slice(0, maxSel);
        else picked = picked.slice(0, 1);
        inArea = picked;
        cells = [];
        seen = Object.create(null);
        for (i = 0; i < inArea.length; i++) {
          cellList = impactMapEffectCells(inArea[i], wpn, actor.side);
          for (j = 0; j < cellList.length; j++) {
            ec = cellList[j];
            key = (ec.x | 0) + ',' + (ec.y | 0);
            if (seen[key]) continue;
            seen[key] = 1;
            cells.push({ x: ec.x | 0, y: ec.y | 0 });
          }
        }
      } else {
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

        if (maxSel > 0) {
          inArea = inArea.slice().sort(function (a, b) {
            return (a.hp | 0) - (b.hp | 0);
          }).slice(0, maxSel);
        }
      }

      /* Always 2+ living enemies in the shape, including engage (MAP is rare vs EX). */
      minNeed = 2;
      if (inArea.length < minNeed) continue;
      if (!inArea.some(function (e) { return e === target; })) continue;

      mapKills = 0;
      totalDmg = 0;
      mapDmgOnEngage = 0;
      for (i = 0; i < inArea.length; i++) {
        mt = inArea[i];
        /* MAP bypasses Defend/Shield — plan with full damage. */
        mDmg = rawWeaponDamage(actor, mt, wpn, damageOf);
        totalDmg += mDmg;
        if (mt === target) mapDmgOnEngage = mDmg;
        if ((mt.hp | 0) - mDmg <= 0) mapKills++;
      }
      engageKilled = (target.hp | 0) - mapDmgOnEngage <= 0;
      /*
       * Engage already known to survive best non-MAP (gate above).
       * MAP only if raw damage KO's that same engage target
       * (not side-only kills / chip).
       */
      better = !!engageKilled;
      if (!better) continue;

      if (isDash) {
        fireActor = {
          x: simPos.x, y: simPos.y, size: simPos.size,
          side: actor.side, direction: actor.direction
        };
        dashTo = resolveDashLandCell(fireActor, wpn, allUnits, bounds);
      }

      if (!best || mapKills > best.mapKills || (mapKills === best.mapKills && totalDmg > best.totalDmg) ||
          (mapKills === best.mapKills && totalDmg === best.totalDmg && inArea.length > (best.targets || []).length)) {
        best = {
          weapon: wpn,
          targets: inArea,
          cells: cells.slice(),
          moveTo: needMove ? { x: simPos.x, y: simPos.y } : null,
          dashTo: dashTo,
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
   * MLS combatQueue builder — waves:
   * 0 preempt (rewritten), 1 SA, 2 main, 3 support-counter, 4 counter.
   */
  /** Units on the same force as `unit` (friends∪foes filtered by .side). */
  function sameSideUnits(unit, friends, foes) {
    var out = [];
    var side = unit && unit.side;
    if (side !== 'ally' && side !== 'enemy') return out;
    (friends || []).concat(foes || []).forEach(function (u) {
      if (!u || (u.hp | 0) <= 0) return;
      if (u.side !== side) return;
      if (out.indexOf(u) >= 0) return;
      out.push(u);
    });
    return out;
  }

  function buildCombatQueue(actor, target, weapon, friends, foes, damageOf) {
    var dist = distance(actor, target);
    var queue = [];
    var defenderAction = 'none';
    var actualDefender = target;
    /* Cover only from the target’s own force — never the attacker’s (cross-side S.Def bug). */
    var bestGuard = pickSupportDefender(target, sameSideUnits(target, friends, foes));
    var tempExpected = 0;
    var tempDefAction = 'none';
    var isTargetCountering = true;
    var counterGuard = null;
    var actualCounterDefender = actor;
    var counterDefAction = 'none';
    var bestCounterWpn = null;
    var predictedHp, actorPredictedHp;
    var saCands, i, su, distS, bg, scored, counterWpns, hasPreCounter;

    /* SA / Support Counter hits use isSupport — rank + predict with the same flag. */
    function damageOfSupport(a, d, w) {
      if (typeof damageOf !== 'function') return (w && w.power) | 0;
      return damageOf(a, d, w, { isSupport: true }) | 0;
    }

    function bestWpnAt(cand, tgt, d) {
      var wpns = getValidWeapons(cand, d, true).filter(function (w) { return !isMapWeapon(w); });
      var ranked = rankWeaponsByDamage(cand, tgt, wpns, damageOfSupport);
      return ranked.length ? ranked[0].weapon : null;
    }

    if (bestGuard) {
      bestGuard.usedSupportDefendCount = (bestGuard.usedSupportDefendCount | 0) + 1;
      bestGuard.battleSupportDefendedCount = (bestGuard.battleSupportDefendedCount | 0) + 1;
      actualDefender = bestGuard;
      defenderAction = hasShieldMechanism(bestGuard) ? 'shield' : 'defend';
      /*
       * Live ML: S.Def takes the incoming hits; the *covered* unit still counters afterward
       * when a weapon reaches the attacker (range/EN/ammo). Do NOT cancel isTargetCountering.
       */
    }

    if (!bestGuard) {
      tempExpected = typeof damageOf === 'function' ? (damageOf(actor, actualDefender, weapon) | 0) : (weapon.power | 0);
      /* Same Mobility sort + 3-cap as the real SA wave (defend/evade prediction). */
      saCands = alive(friends).filter(function (u) {
        return u !== actor && u.side === actor.side && supportAttackRemaining(u) > 0;
      }).map(function (su) {
        distS = distance(su, target);
        bg = bestWpnAt(su, target, distS);
        if (!bg || (su.currentEn | 0) < getEffectiveEnCost(su, bg, true)) return null;
        return {
          unit: su, dist: distS, wpn: bg,
          spd: (su.mobility | 0) + (su.reaction | 0),
          dmg: damageOfSupport(su, actualDefender, bg) | 0
        };
      }).filter(Boolean).sort(function (a, b) { return b.spd - a.spd; })
        .slice(0, MAX_SUPPORT_PARTICIPANTS);
      for (i = 0; i < saCands.length; i++) tempExpected += saCands[i].dmg | 0;
      counterWpns = getValidWeapons(target, dist, false).filter(function (w) { return !isMapWeapon(w); });
      hasPreCounter = counterWpns.some(function (w) { return isPreemptiveWeapon(target, w); });
      tempDefAction = determineDefenseAction(target, tempExpected, counterWpns.length > 0, hasPreCounter);
    }

    predictedHp = actualDefender.hp | 0;
    predictedHp -= typeof damageOf === 'function' ? (damageOf(actor, actualDefender, weapon) | 0) : (weapon.power | 0);

    saCands = alive(friends).filter(function (u) {
      return u !== actor && u.side === actor.side && supportAttackRemaining(u) > 0;
    }).map(function (su) {
      distS = distance(su, target);
      bg = bestWpnAt(su, target, distS);
      if (!bg || (su.currentEn | 0) < getEffectiveEnCost(su, bg, true)) return null;
      return { unit: su, dist: distS, wpn: bg, spd: (su.mobility | 0) + (su.reaction | 0) };
    }).filter(Boolean).sort(function (a, b) { return b.spd - a.spd; })
      .slice(0, MAX_SUPPORT_PARTICIPANTS);

    for (i = 0; i < saCands.length; i++) {
      if (predictedHp <= 0) break;
      queue.push({
        wave: 1, type: 'support', attacker: saCands[i].unit, defender: actualDefender,
        weapon: saCands[i].wpn, distance: saCands[i].dist,
        forcedDefenderAction: bestGuard ? defenderAction : undefined,
        originalTarget: target
      });
      predictedHp -= damageOfSupport(saCands[i].unit, actualDefender, saCands[i].wpn) | 0;
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
      counterGuard = pickCounterSupportDefender(actor, sameSideUnits(actor, friends, foes));
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
       MLS: one queue entry per unit per combat; multi-use stock spans engagements.
       LANG: max 3 Support Counter participants per combat (same cap as SA). */
    {
      var eSup = alive(foes).filter(function (u) {
        return u !== target && u.side === target.side && supportAttackRemaining(u) > 0;
      }).map(function (su) {
        distS = distance(su, actor);
        bg = bestWpnAt(su, actor, distS);
        if (!bg || (su.currentEn | 0) < getEffectiveEnCost(su, bg, true)) return null;
        return { unit: su, dist: distS, wpn: bg, spd: (su.mobility | 0) + (su.reaction | 0) };
      }).filter(Boolean).sort(function (a, b) { return b.spd - a.spd; })
        .slice(0, MAX_SUPPORT_PARTICIPANTS);
      for (i = 0; i < eSup.length; i++) {
        if (actorPredictedHp <= 0) break;
        queue.push({
          wave: 3, type: 'support_counter', attacker: eSup[i].unit, defender: actualCounterDefender,
          weapon: eSup[i].wpn, distance: eSup[i].dist,
          forcedDefenderAction: counterGuard ? counterDefAction : undefined,
          originalTarget: actor
        });
        actorPredictedHp -= damageOfSupport(eSup[i].unit, actualCounterDefender, eSup[i].wpn) | 0;
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

    /*
     * m_help Preemptive Strike: if both attacker and counterattacker have it,
     * the attacker is prioritized. Then MOB+Reaction within the same side.
     */
    function preemptSidePriority(q) {
      if (!q) return 9;
      if (q.type === 'main' || q.type === 'support') return 0;
      if (q.type === 'support_counter' || q.type === 'counter') return 1;
      return 2;
    }

    queue.sort(function (a, b) {
      var spdA, spdB, priA, priB;
      if (a.wave !== b.wave) return a.wave - b.wave;
      if ((a.wave | 0) === 0) {
        priA = preemptSidePriority(a);
        priB = preemptSidePriority(b);
        if (priA !== priB) return priA - priB;
      }
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
   * tiles from the source footprint (MLS getDistance). Includes ability icon for HUD.
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
   * MLS executeAttack weapon MP cost (non-support, non-MAP).
   * Pilot 「消費MPがN軽減」 reduces the cost.
   */
  /**
   * MP spent on fire. EN: "Can be used when consuming 5 MP."
   * JA: "5MP消費時に使用可能。" · TW/HK: "消耗5MP時可使用。"
   * Affinity lines like "reduce weapons MP consumption by 2" (条件付き) subtract.
   */
  function weaponMpCost(actor, weapon, isSupport) {
    var blob, m, cost;
    if (!weapon || isSupport || isMapWeapon(weapon)) return 0;
    blob = normalizeFullwidth(weaponEffectBlob(weapon));
    m = blob.match(/Can be used when consuming\s*(\d+)\s*MP/i)
      || blob.match(/(\d+)\s*MP消費時に使用可能/)
      || blob.match(/消耗\s*(\d+)\s*MP時可使用/)
      || blob.match(/消耗\s*(\d+)\s*MP时可使用/)
      || blob.match(/MP消費(\d+)|Consumes?\s*(\d+)\s*MP|MP\s*cost\s*(\d+)/i);
    if (!m) return 0;
    cost = parseInt(m[1] || m[2] || m[3], 10) || 0;
    if (cost <= 0) return 0;
    iterAbilityDetails(actor, function (ab, detail, text) {
      var t, mm, cut;
      if (detail && !detailConditionsMet(actor, detail)) return;
      t = normalizeFullwidth(String(text || ''));
      mm = t.match(/reduce\s+weapons?\s*MP\s*consumption\s+by\s+(\d+)/i)
        || t.match(/武装の消費MPが(\d+)軽減/)
        || t.match(/武裝(?:的)?消耗MP(?:減少|降低|減輕)(\d+)/)
        || t.match(/消費MP(?:が)?(\d+)軽減/)
        || t.match(/MP\s*cost\s*(?:reduc\w*\s*)?(?:by\s*)?(\d+)/i);
      if (!mm) return;
      cut = parseInt(mm[1], 10) || 0;
      if (cut > 0) cost = Math.max(0, cost - cut);
    });
    return cost;
  }

  /**
   * MLS evaluateExPhase — Supercharged (超一撃) EX1/EX2 progression.
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
    iterAbilityDetails(actor, function (ab, detail, text) {
      var v;
      if (detail && !detailConditionsMet(actor, detail)) return;
      /* Skip weapon-on-hit / MAP supply wording — not battle-start MP. */
      if (/on hit|MAP Weapon|MP Supply|敵.*MP|enemy MP|Decrease.*MP/i.test(text || '')) return;
      /* Unit-skill lines (“1 time(s)” / on activate) are applied in planUnitSkill, not here. */
      if (/\(\s*1\s*time|1\s*回|1\s*次|1\s*회|\(1 turns?/i.test(text || '') &&
          /Increase\s+(?:own\s+)?MP|MP(?:が|を)\s*\d+\s*上昇|自身MP/i.test(text || '')) {
        return;
      }
      v = parseStartingMpFromText(text);
      if (v > 0) total += v;
    });
    /*
     * Do NOT add unit-skill trait type 12 (MpBoost) here — that is on-skill-use only
     * (e.g. V2 Assault Buster +3 MP). Baking it into battle-start made Uso start at 9
     * then skill again → false Supercharged → Guaranteed CS before any kill.
     */
    return Math.max(0, Math.min(12, total | 0));
  }

  var api = {
    setRandom: setRandom,
    unitSize: unitSize,
    distance: distance,
    chebyshev: distance,
    checkOverlap: checkOverlap,
    footprintCellsAt: footprintCellsAt,
    wouldOverlapUnit: wouldOverlapUnit,
    actionOrder: actionOrder,
    unitOrderSpeed: unitOrderSpeed,
    displayOrder: displayOrder,
    weaponsInRange: weaponsInRange,
    getWeaponRangeBonus: getWeaponRangeBonus,
    isMapWeapon: isMapWeapon,
    weaponEffectBlob: weaponEffectBlob,
    weaponMpCost: weaponMpCost,
    weaponMpRequirement: weaponMpRequirement,
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
    pilotRoleKey: pilotRoleKey,
    roleDefaultSupportAttack: roleDefaultSupportAttack,
    roleDefaultSupportDefend: roleDefaultSupportDefend,
    MAX_SUPPORT_PARTICIPANTS: MAX_SUPPORT_PARTICIPANTS,
    pickSupportDefender: pickSupportDefender,
    pickCounterSupportDefender: pickCounterSupportDefender,
    pickSupportAttacker: pickSupportAttacker,
    canCounterSupportDefend: canCounterSupportDefend,
    canSupportDefendOnTarget: canSupportDefendOnTarget,
    unitOccupancyMode: unitOccupancyMode,
    terrainRowLevel: terrainRowLevel,
    buildPilotSkillKit: buildPilotSkillKit,
    pickSkill: pickSkill,
    parseMpUpAmount: parseMpUpAmount,
    weaponsNeedMoreMp: weaponsNeedMoreMp,
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
    parseParryKit: parseParryKit,
    tryParry: tryParry,
    weaponMatchesParryPairs: weaponMatchesParryPairs,
    calculateCriticalRate: calculateCriticalRate,
    checkAndAcquireUnconditionalCS: checkAndAcquireUnconditionalCS,
    autoCsTimesAvailable: autoCsTimesAvailable,
    grantsAutoCsAfterCombat: grantsAutoCsAfterCombat,
    grantsGuaranteedCsAfterCombat: grantsGuaranteedCsAfterCombat,
    chanceStepLabels: chanceStepLabels,
    evaluateMapWeapon: evaluateMapWeapon,
    expectedDamageWithAiDefense: expectedDamageWithAiDefense,
    isDashMapWeapon: isDashMapWeapon,
    resolveDashLandCell: resolveDashLandCell,
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
