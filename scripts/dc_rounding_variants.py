"""Rounding variant search for 28500/28501."""
import math

C = math.ceil
F = math.floor
MX = max
EXP = math.exp


def variants(ua, ca, cd, ud, wp, N):
    csr = MX(0, ca - cd) / 5000
    usr = MX(0, C((ua / 10) - (ud / 10))) / 5000
    csig = 1 / (EXP((250 * (cd - ca)) / 100000) + 1)
    usig = 1 / (EXP((25 * (ud - ua)) / 100000) + 1)
    bd = C((csr + usr + csig + usig) * wp)
    ac = C((ua + 2 * ca) / 10)
    dc = C((ud + 2 * cd) / 10)
    oc = 100 / (EXP(((5000 - ac) * 30) / 100000) + 1)
    df = -40 / (EXP(((5000 - dc) * 3) / 100000) + 1)
    dcorr = (oc + df) * bd
    out = {}
    for bdm_name, bdm in [
        ("cur", C(bd + dcorr)),
        ("split", C(bd + C(oc * bd) + C(df * bd))),
        ("add_ceil", C(bd) + C(dcorr)),
    ]:
        sn = C(N * bdm / 100)
        out[f"{bdm_name}_final_ceil"] = C(bdm + sn)
        out[f"{bdm_name}_split_pct"] = C(bdm) + C(sn)
        out[bdm_name] = bdm
    return out


cd, ud = 705, 25072
ca = 807
for ua, wp, N in [(14010, 5565, 0), (14007, 5545, 0), (14823, 6360, 0), (16779, 6360, 15)]:
    v = variants(ua, ca, cd, ud, wp, N)
    hits = {k: n for k, n in v.items() if 28499 <= n <= 28502}
    print(f"ua={ua} wp={wp} N={N}")
    if hits:
        print("  HITS:", hits)
    else:
        print("  cur=", v.get("cur_final_ceil"), " split=", v.get("split_final_ceil"))
