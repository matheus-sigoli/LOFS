"""Gera as animações Lottie da LOFS (escudo, loader, bola fora). Saída em JSON."""
import json, math, sys

FR = 60
K = 0.5523

VERDE = [0.118, 0.627, 0.31, 1]      # ~#1ea04f (logo)
VERMELHO = [0.918, 0.212, 0.224, 1]  # ~#ea3639
ESCURO = [0.231, 0.231, 0.231, 1]    # #3b3b3b
BRANCO = [1, 1, 1, 1]
CINZA = [0.66, 0.66, 0.66, 1]

# ------------------------------------------------------------------ helpers
def ease(x1=0.33, y1=0, x2=0.67, y2=1):
    return {"o": {"x": [x1], "y": [y1]}, "i": {"x": [x2], "y": [y2]}}

E_OUT = (0.16, 1, 0.3, 1)      # entrada firme, desacelera
E_INOUT = (0.65, 0, 0.35, 1)
E_IN = (0.55, 0, 1, 0.45)

def anim(kfs, curva=E_OUT):
    """kfs: [(t, valor), ...]; valor escalar ou lista."""
    out = []
    for i, (t, v) in enumerate(kfs):
        v = v if isinstance(v, list) else [v]
        k = {"t": t, "s": v}
        if i < len(kfs) - 1:
            c = curva[i] if isinstance(curva, list) else curva
            n = len(v)
            k["o"] = {"x": [c[0]] * n, "y": [c[1]] * n}
            k["i"] = {"x": [c[2]] * n, "y": [c[3]] * n}
        out.append(k)
    return {"a": 1, "k": out}

def st(v):
    return {"a": 0, "k": v}

def path(pts, fechado=True, tin=None, tout=None):
    n = len(pts)
    return {"ty": "sh", "ks": st({"i": tin or [[0, 0]] * n, "o": tout or [[0, 0]] * n,
                                   "v": [list(p) for p in pts], "c": fechado})}

def circulo_path(cx, cy, r):
    v = [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]]
    d = r * K
    i = [[-d, 0], [0, -d], [d, 0], [0, d]]
    o = [[d, 0], [0, d], [-d, 0], [0, -d]]
    return {"i": i, "o": o, "v": v, "c": True}

def fill(cor, op=100):
    return {"ty": "fl", "c": st(cor), "o": st(op) if not isinstance(op, dict) else op, "r": 1}

def stroke(cor, w, op=100, cap=2, join=2):
    return {"ty": "st", "c": st(cor), "o": st(op) if not isinstance(op, dict) else op,
            "w": st(w), "lc": cap, "lj": join}

def trim(e, s=0):
    return {"ty": "tm", "s": st(s) if not isinstance(s, dict) else s,
            "e": e if isinstance(e, dict) else st(e), "o": st(0), "m": 1}

def tr(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    def v(x):
        return x if isinstance(x, dict) else st(list(x) if isinstance(x, tuple) else x)
    return {"ty": "tr", "p": v(p), "a": v(a), "s": v(s), "r": v(r), "o": v(o)}

def grupo(nome, itens, transform=None):
    return {"ty": "gr", "nm": nome, "it": itens + [transform or tr()]}

def ks(p=(0, 0), a=(0, 0), s=(100, 100), r=0, o=100):
    def v(x):
        if isinstance(x, dict):
            return x
        return st(list(x) + [0] if isinstance(x, tuple) and len(x) == 2 else (list(x) if isinstance(x, tuple) else x))
    return {"p": v(p), "a": v(a), "s": v(s), "r": v(r), "o": v(o)}

_ind = [0]
def camada(nome, shapes, ksv=None, ip=0, op=999, masks=None, parent=None):
    _ind[0] += 1
    c = {"ddd": 0, "ind": _ind[0], "ty": 4, "nm": nome, "sr": 1, "ks": ksv or ks(),
         "ao": 0, "shapes": shapes, "ip": ip, "op": op, "st": 0, "bm": 0}
    if masks:
        c["hasMask"] = True
        c["masksProperties"] = masks
    if parent:
        c["parent"] = parent
    return c

def doc(nome, w, h, op, layers):
    return {"v": "5.12.2", "fr": FR, "ip": 0, "op": op, "w": w, "h": h, "nm": nome,
            "ddd": 0, "assets": [], "layers": layers}

# ------------------------------------------------------------------ bola
def pentagono(cx, cy, r, rot=-90):
    return [(cx + r * math.cos(math.radians(rot + 72 * i)), cy + r * math.sin(math.radians(rot + 72 * i))) for i in range(5)]

def bola_shapes(cx, cy, R, contorno=10):
    itens = []
    # gomos externos (serão recortados pela máscara da camada)
    for i in range(5):
        ang = math.radians(-90 + 36 + 72 * i)
        px, py = cx + R * 0.97 * math.cos(ang), cy + R * 0.97 * math.sin(ang)
        itens.append(grupo(f"gomo{i}", [path(pentagono(px, py, R * 0.32, math.degrees(ang) + 180)), fill(ESCURO)]))
    itens.append(grupo("centro", [path(pentagono(cx, cy, R * 0.3)), fill(ESCURO)]))
    # costuras
    for i in range(5):
        a = math.radians(-90 + 72 * i)
        x1, y1 = cx + R * 0.3 * math.cos(a), cy + R * 0.34 * math.sin(a)
        x2, y2 = cx + R * 0.68 * math.cos(a), cy + R * 0.62 * math.sin(a)
        itens.append(grupo(f"costura{i}", [path([(x1, y1), (x2, y2)], fechado=False), stroke(ESCURO, R * 0.07)]))
    itens.append(grupo("couro", [{"ty": "sh", "ks": st(circulo_path(cx, cy, R))}, fill(BRANCO)]))
    contorno_g = grupo("contorno", [{"ty": "sh", "ks": st(circulo_path(cx, cy, R))}, stroke(ESCURO, contorno)])
    return [contorno_g] + itens

def mascara_circulo(cx, cy, r):
    return [{"inv": False, "mode": "a", "pt": st(circulo_path(cx, cy, r)), "o": st(100), "x": st(0), "nm": "m"}]

# ------------------------------------------------------------------ 1. escudo
def escudo():
    _ind[0] = 0
    W, H, OP = 470, 512, 150
    cx, cy, R = 238, 338, 92
    layers = []

    # contorno do escudo
    s_pts = [(62, 14), (408, 14), (456, 62), (456, 372), (235, 500), (14, 372), (14, 62)]
    tin = [[-26, 0], [0, 0], [0, -26], [0, 0], [0, 0], [0, 0], [0, 26]]
    tout = [[0, 0], [26, 0], [0, 0], [0, 0], [0, 0], [0, -26], [0, 0]]
    # gol: rede (atrás da bola)
    rede = []
    def fio(p0, p3, puxa=0.22):
        # curva cúbica que "estufa" em direção ao centro da bola
        mx, my = (p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2
        dx, dy = (cx - mx) * puxa, (cy - my) * puxa
        c1 = (p0[0] + (p3[0] - p0[0]) / 3 + dx, p0[1] + (p3[1] - p0[1]) / 3 + dy)
        c2 = (p0[0] + 2 * (p3[0] - p0[0]) / 3 + dx, p0[1] + 2 * (p3[1] - p0[1]) / 3 + dy)
        return path([p0, p3], fechado=False, tin=[[0, 0], [c2[0] - p3[0], c2[1] - p3[1]]],
                    tout=[[c1[0] - p0[0], c1[1] - p0[1]], [0, 0]])
    fam_a = [((70 + 52 * i, 180), (250 + 40 * i, 440 - 18 * i)) for i in range(4)]
    fam_b = [((32, 230 + 50 * i), (330 - 10 * i, 190 + 48 * i)) for i in range(4)]
    for i, (a, b) in enumerate(fam_a + fam_b):
        rede.append(grupo(f"fio{i}", [fio(a, b), stroke(CINZA, 5, cap=2)]))
    # 1) camada branca do escudo (fundo) + contorno desenhado
    layers.append(camada("contorno", [
        grupo("linha", [path(s_pts, tin=tin, tout=tout),
                        trim(anim([(0, 0), (34, 100)], E_INOUT)),
                        stroke(ESCURO, 22, cap=2, join=2)])]))
    layers.append(camada("letras", letras()))
    layers.append(camada("bola", bola_shapes(cx, cy, R),
                         ks(p=anim([(58, [-40, 600, 0]), (92, [cx, cy, 0]), (100, [cx + 6, cy - 4, 0]), (110, [cx, cy, 0])],
                                   [E_OUT, E_OUT, E_INOUT]),
                            a=(cx, cy),
                            s=anim([(58, [150, 150, 100]), (92, [96, 96, 100]), (100, [103, 103, 100]), (110, [100, 100, 100])],
                                   [E_OUT, E_OUT, E_INOUT]),
                            r=anim([(58, -260), (110, 0)], E_OUT),
                            o=anim([(58, 0), (64, 100)])),
                         masks=None, ip=58))
    # rede: aparece e "estufa" no impacto (frame 92)
    layers.append(camada("rede", rede,
                         ks(p=(cx, cy), a=(cx, cy),
                            s=anim([(88, [100, 100, 100]), (98, [107, 104, 100]), (112, [98, 99, 100]), (124, [100, 100, 100])],
                                   [E_OUT, E_INOUT, E_INOUT]),
                            o=anim([(40, 0), (56, 100)]))))
    # faixas
    verde = [(24, 172), (166, 172), (166, 452), (24, 369)]
    vermelho = [(306, 172), (446, 172), (446, 369), (306, 452)]
    layers.append(camada("faixa-verde", [grupo("v", [path(verde), fill(VERDE)])],
                         ks(p=(24, 172), a=(24, 172), s=anim([(16, [0, 100, 100]), (44, [100, 100, 100])]))))
    layers.append(camada("faixa-vermelha", [grupo("r", [path(vermelho), fill(VERMELHO)])],
                         ks(p=(446, 172), a=(446, 172), s=anim([(22, [0, 100, 100]), (50, [100, 100, 100])]))))
    layers.append(camada("fundo", [grupo("f", [path(s_pts, tin=tin, tout=tout), fill(BRANCO)])],
                         ks(o=anim([(4, 0), (26, 100)]))))
    ordem = ["contorno", "letras", "rede", "bola", "faixa-verde", "faixa-vermelha", "fundo"]
    layers.sort(key=lambda l: ordem.index(l["nm"]))
    for i, l in enumerate(layers):
        l["ind"] = i + 1
    # máscara circular da bola recorta os gomos
    for l in layers:
        if l["nm"] == "bola":
            l["hasMask"] = True
            l["masksProperties"] = mascara_circulo(cx, cy, R)
    return doc("LOFS escudo", W, H, OP, layers)

def letras():
    w = 27  # espessura do traço das letras
    itens = []
    base, topo = 128, 50
    t0 = 36
    def L(nome, shp, i):
        return grupo(nome, shp + [trim(anim([(t0 + i * 5, 0), (t0 + i * 5 + 22, 100)], E_OUT)), stroke(ESCURO, w, cap=1, join=1)])
    # L
    itens.append(L("L", [path([(52, topo), (52, base), (112, base)], fechado=False)], 0))
    # O (retângulo arredondado)
    itens.append(L("O", [{"ty": "rc", "p": st([186, 89]), "s": st([88, 76]), "r": st(28), "d": 1}], 1))
    # F
    itens.append(L("F1", [path([(316, topo), (262, topo), (262, base)], fechado=False)], 2))
    itens.append(L("F2", [path([(262, 88), (306, 88)], fechado=False)], 2.6))
    # S
    s = [(430, topo), (366, topo), (342, 69), (366, 88), (408, 88), (432, 108), (408, base), (340, base)]
    s_in = [[0, 0], [0, 0], [0, -11], [-13, 0], [0, 0], [0, -11], [13, 0], [0, 0]]
    s_out = [[0, 0], [-13, 0], [0, 11], [0, 0], [13, 0], [0, 11], [0, 0], [0, 0]]
    itens.append(L("S", [path(s, fechado=False, tin=s_in, tout=s_out)], 3))
    return itens

# ------------------------------------------------------------------ 2. loader (bola quicando)
def loader():
    _ind[0] = 0
    W, H, OP = 120, 120, 60
    cx, R = 60, 20
    chao = 100
    y_top, y_bot = 32, chao - R
    curva = [E_OUT, (0.33, 0, 0.83, 0.67)]
    y = anim([(0, [cx, y_bot, 0]), (30, [cx, y_top, 0]), (60, [cx, y_bot, 0])], [E_OUT, E_IN])
    sx = anim([(0, [112, 88, 100]), (6, [96, 104, 100]), (30, [100, 100, 100]), (54, [96, 104, 100]), (60, [112, 88, 100])],
              [E_OUT, E_OUT, E_IN, E_IN])
    layers = [
        camada("bola", bola_shapes(cx, y_bot, R, contorno=3),
               ks(p=y, a=(cx, y_bot), s=sx, r=anim([(0, 0), (60, 180)], (0.33, 0.33, 0.67, 0.67))),
               masks=mascara_circulo(cx, y_bot, R)),
        camada("sombra", [grupo("s", [{"ty": "el", "p": st([cx, chao + 6]), "s": st([44, 8]), "d": 1}, fill(BRANCO)])],
               ks(p=(cx, chao + 6), a=(cx, chao + 6),
                  s=anim([(0, [100, 100, 100]), (30, [50, 50, 100]), (60, [100, 100, 100])], [E_OUT, E_IN]),
                  o=anim([(0, 22), (30, 8), (60, 22)], [E_OUT, E_IN]))),
    ]
    return doc("LOFS carregando", W, H, OP, layers)

# ------------------------------------------------------------------ 3. bola fora (404)
def bola_fora():
    _ind[0] = 0
    W, H, OP = 360, 240, 120
    R = 18
    layers = []
    # bola: vem da esquerda, bate na trave (x=262,y=60) e sai para cima/direita
    # bate na trave, volta, quica no chão e para em frente ao gol
    chao_y = 226 - R
    p = anim([(0, [20, chao_y, 0]), (34, [244, 70, 0]), (58, [196, chao_y, 0]), (72, [176, 168, 0]),
              (84, [160, chao_y, 0]), (104, [140, chao_y, 0])],
             [(0.3, 0.2, 0.6, 1), E_IN, E_OUT, E_IN, E_OUT])
    layers.append(camada("bola", bola_shapes(0, 0, R, contorno=3),
                         ks(p=p, r=anim([(0, 0), (34, 400), (58, 300), (104, 180)], [E_OUT, E_OUT, E_OUT])),
                         masks=mascara_circulo(0, 0, R), op=OP))
    # trave tremendo no impacto
    trave = grupo("trave", [path([(270, 225), (270, 60), (350, 60)], fechado=False), stroke(BRANCO, 8, cap=1, join=1)])
    rede = grupo("rede", [path([(280, 70), (280, 225)], fechado=False), path([(300, 70), (300, 225)], fechado=False),
                          path([(320, 70), (320, 225)], fechado=False), path([(278, 110), (350, 110)], fechado=False),
                          path([(278, 160), (350, 160)], fechado=False), stroke(CINZA, 2, op=60)])
    layers.append(camada("gol", [trave, rede],
                         ks(p=anim([(34, [0, 0, 0]), (37, [5, -2, 0]), (41, [-4, 1, 0]), (45, [2, 0, 0]), (50, [0, 0, 0])],
                                   [E_INOUT] * 4))))
    layers.append(camada("chao", [grupo("c", [path([(10, 226), (350, 226)], fechado=False), stroke(BRANCO, 2, op=25)])]))
    return doc("LOFS bola fora", W, H, OP, layers)


if __name__ == "__main__":
    destino = sys.argv[1]
    for nome, f in [("escudo", escudo), ("carregando", loader), ("bola-fora", bola_fora)]:
        with open(f"{destino}/{nome}.json", "w") as fp:
            json.dump(f(), fp, separators=(",", ":"))
        print(nome, "ok")
