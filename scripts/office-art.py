# AI Office: draws the office people. Bodies by AI colour and pose, heads by look and mood.
# Desks and the boss desk are hand-written SVGs in defaults/mods/office.
#   python3 scripts/office-art.py defaults/mods/office
import os, sys
out = sys.argv[1]
SKIN, INK, CHAIR, PANTS = "#F2C7A5", "#2E2A27", "#5B6470", "#3F4A5A"
SHIRTS = {"claude": ("#D97757", "#B85F42"), "codex": ("#3F7FD8", "#2F63AD"), "other": ("#7B8794", "#626C78")}

def svg(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'

# ---------- bodies (no head; the head image sits on top) ----------
def seated(pose, shirt, dark):
    s = f'<rect x="15" y="30" width="50" height="50" rx="13" fill="{CHAIR}"/>'
    s += f'<rect x="22" y="46" width="36" height="40" rx="12" fill="{shirt}"/>'
    if pose == "raise":
        s += f'<rect x="17" y="52" width="10" height="26" rx="5" fill="{dark}"/>'
        s += f'<rect x="54" y="9" width="10" height="44" rx="5" fill="{dark}"/><circle cx="59" cy="9" r="5.5" fill="{SKIN}"/>'
    elif pose == "rest":
        s += f'<rect x="22" y="58" width="36" height="10" rx="5" fill="{dark}"/>'
    else:
        s += f'<rect x="17" y="52" width="10" height="26" rx="5" fill="{dark}"/><rect x="53" y="52" width="10" height="26" rx="5" fill="{dark}"/>'
    return svg(80, 80, s)

def standing(shirt, dark):
    s = '<ellipse cx="24" cy="77" rx="15" ry="2.5" fill="#000" opacity=".12"/>'
    s += f'<rect x="15" y="52" width="8" height="24" rx="3" fill="{PANTS}"/><rect x="25" y="52" width="8" height="24" rx="3" fill="{PANTS}"/>'
    s += f'<ellipse cx="19" cy="76" rx="5" ry="2.5" fill="{INK}"/><ellipse cx="29" cy="76" rx="5" ry="2.5" fill="{INK}"/>'
    s += f'<rect x="11" y="24" width="26" height="34" rx="9" fill="{shirt}"/>'
    s += f'<rect x="6" y="28" width="8" height="22" rx="4" fill="{dark}"/><rect x="34" y="28" width="8" height="22" rx="4" fill="{dark}"/>'
    s += '<rect x="13" y="34" width="22" height="20" rx="2" fill="#FFFFFF" stroke="#CFC6B8"/>'
    s += '<path d="M17 39h14M17 43h14M17 47h9" stroke="#B9AFA2" stroke-width="1.5" stroke-linecap="round"/>'
    s += f'<circle cx="12" cy="49" r="3.5" fill="{SKIN}"/><circle cx="36" cy="49" r="3.5" fill="{SKIN}"/>'
    return svg(48, 80, s)

# ---------- heads: 40x40, face centred at (20, 22), radius 13 ----------
def eyes(mood, y=22, dx=5, col=INK):
    if mood == "sleep":
        return f'<path d="M{20-dx-2} {y} q2 1.8 4 0 M{20+dx-2} {y} q2 1.8 4 0" stroke="{col}" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
    return f'<circle cx="{20-dx}" cy="{y}" r="1.7" fill="{col}"/><circle cx="{20+dx}" cy="{y}" r="1.7" fill="{col}"/>'

def human_mouth(mood):
    if mood == "call":
        return f'<ellipse cx="20" cy="28.5" rx="2.6" ry="2.2" fill="{INK}"/>'
    return f'<path d="M16 27 Q20 30 24 27" stroke="{INK}" stroke-width="1.4" fill="none" stroke-linecap="round"/>'

def animal_mouth(mood, y=27.5):
    if mood == "call":
        return f'<ellipse cx="20" cy="{y+1}" rx="2.2" ry="2" fill="{INK}"/>'
    return f'<path d="M17 {y} q1.5 1.8 3 0 q1.5 1.8 3 0" stroke="{INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>'

def cheeks(col="#E9967A", op=".35"):
    return f'<circle cx="12" cy="25" r="2.4" fill="{col}" opacity="{op}"/><circle cx="28" cy="25" r="2.4" fill="{col}" opacity="{op}"/>'

def head(look, mood):
    face = f'<circle cx="20" cy="22" r="13" fill="{SKIN}"/>'
    if look == "short":
        s = face + '<path d="M7 21 A13 13 0 0 1 33 21 Q27 13 20 14 Q13 13 7 21Z" fill="#3B2F2A"/>'
        s += cheeks() + eyes(mood, 23) + human_mouth(mood)
    elif look == "long":
        s = '<path d="M6 22 Q5 8 20 7 Q35 8 34 22 L35 36 Q31 37 29 33 L29 22 Q20 18 11 22 L11 33 Q9 37 5 36Z" fill="#6B4423"/>'
        s += face + '<path d="M7 21 A13 13 0 0 1 33 21 Q29 12 20 13 Q13 14 10 20 Q9 21 7 21Z" fill="#6B4423"/>'
        s += cheeks() + eyes(mood, 23) + human_mouth(mood)
    elif look == "bun":
        s = '<circle cx="20" cy="7" r="6" fill="#26201D"/>' + face
        s += '<path d="M7 21 A13 13 0 0 1 33 21 Q27 14 20 14.5 Q13 14 7 21Z" fill="#26201D"/>'
        s += cheeks() + eyes(mood, 23) + human_mouth(mood)
    elif look == "cat":
        f = "#F2B36B"
        s = f'<path d="M8 15 L9 3 L18 11Z M32 15 L31 3 L22 11Z" fill="{f}"/><path d="M10 12 L10.5 6 L15 10Z M30 12 L29.5 6 L25 10Z" fill="#F7A6A0"/>'
        s += f'<circle cx="20" cy="22" r="13" fill="{f}"/><path d="M14 10 l2 5 M20 9 v5 M26 10 l-2 5" stroke="#D98E45" stroke-width="2" stroke-linecap="round"/>'
        s += '<ellipse cx="20" cy="27" rx="6" ry="4.5" fill="#FBE3C4"/>' + eyes(mood, 21, 5.5)
        s += '<path d="M18.6 24.6 h2.8 l-1.4 1.6z" fill="#E07A7A"/>' + animal_mouth(mood, 26.5)
        s += f'<path d="M6 25 h6 M6 28 l6 -1.5 M34 25 h-6 M34 28 l-6 -1.5" stroke="{INK}" stroke-width=".8" opacity=".6"/>'
    elif look == "dog":
        f = "#D9B38C"
        s = f'<circle cx="20" cy="22" r="13" fill="{f}"/>'
        s += '<path d="M8 12 Q2 14 4 28 Q8 30 10 22Z M32 12 Q38 14 36 28 Q32 30 30 22Z" fill="#8B5A3C"/>'
        s += '<ellipse cx="20" cy="27.5" rx="6.5" ry="5" fill="#F1DDC5"/>' + eyes(mood, 21, 5.5)
        s += f'<ellipse cx="20" cy="25" rx="2.4" ry="1.8" fill="{INK}"/>' + animal_mouth(mood, 27.5)
    elif look == "rabbit":
        f = "#F5F0EA"
        s = f'<ellipse cx="14" cy="6" rx="4" ry="9" fill="{f}" stroke="#E2D9CE"/><ellipse cx="26" cy="6" rx="4" ry="9" fill="{f}" stroke="#E2D9CE"/>'
        s += '<ellipse cx="14" cy="6" rx="1.8" ry="6.5" fill="#F7B8C0"/><ellipse cx="26" cy="6" rx="1.8" ry="6.5" fill="#F7B8C0"/>'
        s += f'<circle cx="20" cy="22" r="13" fill="{f}" stroke="#E2D9CE"/>' + cheeks("#F7A6B5", ".55") + eyes(mood, 21.5, 5)
        s += '<path d="M18.8 25 h2.4 l-1.2 1.4z" fill="#E88A9A"/>' + animal_mouth(mood, 26.6)
    elif look == "bear":
        f = "#A0714F"
        s = f'<circle cx="9" cy="11" r="5" fill="{f}"/><circle cx="31" cy="11" r="5" fill="{f}"/><circle cx="9" cy="11" r="2.4" fill="#7A5236"/><circle cx="31" cy="11" r="2.4" fill="#7A5236"/>'
        s += f'<circle cx="20" cy="22" r="13" fill="{f}"/><ellipse cx="20" cy="27" rx="6.5" ry="5" fill="#D9B48F"/>'
        s += eyes(mood, 20.5, 5.5) + f'<ellipse cx="20" cy="24.8" rx="2.4" ry="1.7" fill="{INK}"/>' + animal_mouth(mood, 27.3)
    elif look == "panda":
        s = f'<circle cx="9" cy="11" r="5" fill="{INK}"/><circle cx="31" cy="11" r="5" fill="{INK}"/>'
        s += '<circle cx="20" cy="22" r="13" fill="#FBFAF7" stroke="#E4E1DA"/>'
        s += f'<ellipse cx="14.5" cy="21.5" rx="3.6" ry="4.4" fill="{INK}" transform="rotate(-20 14.5 21.5)"/><ellipse cx="25.5" cy="21.5" rx="3.6" ry="4.4" fill="{INK}" transform="rotate(20 25.5 21.5)"/>'
        if mood == "sleep":
            s += '<path d="M13 22 q1.5 1.3 3 0 M24 22 q1.5 1.3 3 0" stroke="#FFFFFF" stroke-width="1.2" fill="none" stroke-linecap="round"/>'
        else:
            s += '<circle cx="15" cy="21.5" r="1.3" fill="#FFFFFF"/><circle cx="25" cy="21.5" r="1.3" fill="#FFFFFF"/>'
        s += f'<ellipse cx="20" cy="25.6" rx="2.2" ry="1.6" fill="{INK}"/>' + animal_mouth(mood, 27.8)
    elif look == "fox":
        f = "#E9844A"
        s = f'<path d="M7 16 L6 2 L17 10Z M33 16 L34 2 L23 10Z" fill="{f}"/><path d="M6.5 7 L6 2 L10 5Z M33.5 7 L34 2 L30 5Z" fill="{INK}"/>'
        s += f'<circle cx="20" cy="22" r="13" fill="{f}"/>'
        s += '<path d="M7 24 Q12 22 20 34 Q28 22 33 24 Q30 33 20 35 Q10 33 7 24Z" fill="#FFF6EC"/>' + eyes(mood, 21, 5.5)
        s += f'<ellipse cx="20" cy="27" rx="2" ry="1.5" fill="{INK}"/>' + animal_mouth(mood, 28.6)
    return svg(40, 40, s)

def write(name, text):
    with open(os.path.join(out, name), "w") as f:
        f.write(text)

for key, (shirt, dark) in SHIRTS.items():
    for pose in ("work", "raise", "rest"):
        write(f"body-{pose}-{key}.svg", seated(pose, shirt, dark))
    write(f"body-stand-{key}.svg", standing(shirt, dark))
for look in ("short", "long", "bun", "cat", "dog", "rabbit", "bear", "panda", "fox"):
    for mood in ("smile", "call", "sleep"):
        write(f"head-{look}-{mood}.svg", head(look, mood))
print("ok")
