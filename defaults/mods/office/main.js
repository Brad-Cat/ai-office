// 辦公室：每個 AI 是一位坐在座位上的員工，畫成斜 45 度（等角）的 3D 卡通。
// 工作中在打字；卡住等你時舉手；閒置時靠著椅背休息。
// 有總經理時：員工做完走到總經理桌前排隊，總經理收了（herdr.seen）就回座位；
// 總經理做完拿報告走到你的辦公桌前，要你決定時在座位上舉手。
// 沒有總經理時：員工做完直接走到你的辦公桌前，最後在問你問題的就舉手。
// 點員工打開他的工作畫面（右邊的終端機）；右鍵或工作畫面標頭的「取名・換造型」可以取名字、換造型和衣服、設總經理。
// 名字存在 shared("office.names")、造型 shared("office.looks")、衣服 shared("office.outfits")，都以分頁為單位。
// 圖在 art/（2 倍大的 PNG），每一層的位置在 art.js。
import { View, div, image, svg, PathBuilder } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, spaces, panes, props, run, setAgentOrder, openOverlay, nextCommand, layouts, shared, setShared, hc } from "herdr";
import { ART3 } from "./art.js";

const ART = "mods/office/art/";
const C = {
  wall: "#F4ECDF", floor: "#EADCC4", floorLine: "#E2D1B4", rug: "#E3CFAE", rugLine: "#D4BB93", skirting: "#C9A57E",
  ink: "#3D3731", muted: "#7A6E62", wood: "#7E5B3E", plate: "#5A4330",
  cream: "#FFF9EE", orange: "#E07B39", green: "#3E9B6A",
};
// 座位：桌子的長邊朝右下（2:1），同一區的座位沿這個方向斜著排，一排放不下就往下開新的一排。
const SEAT_W = 104, STEP_X = 78, STEP_Y = 39, ROW_H = 186, LAST_ROW_H = 150, PAD = 16, ZONE_HEAD = 34, GAP = 14, BOSS_W = 250, WALK_MS = 2400;
const RUG_X = 26;          // 地毯比座位往右多出來的寬度
const STAND = ART3.stand.frame, GM = ART3.gm, BOSS = ART3.boss.frame;
// 辦公室比這個窄時（左邊辦公室、右邊工作畫面）：標題分兩行，總經理桌和你的辦公桌並排在下方。
const NARROW = 900;
const WORD = { work: "工作中", ask: "要你回答", report: "報告好了", toGM: "交給總經理", rest: "休息中" };
const GM_NAME = /^(g\.?\s*m\.?|總經理)$/i;
export const LOOKS = ["short", "long", "bun", "curly", "bob", "ponytail", "beard", "glasses", "cap", "cat", "dog", "rabbit", "bear", "panda", "fox", "tiger", "lion", "koala", "penguin", "monkey", "frog"];
// 已經有 3D 圖的九種。沒選過造型的員工從這裡固定挑一個；其他十二種做好前不列出來，
// 已經選了那些的員工先顯示成這九種之一，但不改掉他原本的選擇。
export const READY_LOOKS = ["short", "long", "bun", "cat", "dog", "rabbit", "bear", "panda", "fox"];
export const LOOK_NAME = { short: "短髮", long: "長髮", bun: "包頭", curly: "捲髮", bob: "鮑伯頭", ponytail: "馬尾", beard: "大鬍子", glasses: "眼鏡", cap: "棒球帽", cat: "貓", dog: "狗", rabbit: "兔子", bear: "熊", panda: "貓熊", fox: "狐狸", tiger: "老虎", lion: "獅子", koala: "無尾熊", penguin: "企鵝", monkey: "猴子", frog: "青蛙" };
export const OUTFITS = ["polo", "hoodie", "cardigan"];

// 衣服顏色看是哪家 AI：橘色 Claude、藍色 Codex、灰色其他。
function shirt(a) {
  const app = `${a.app ?? ""} ${a.program?.name ?? ""}`.toLowerCase();
  return app.includes("claude") ? "claude" : app.includes("codex") ? "codex" : "other";
}

function hash(s) {
  let h = 0;
  for (const ch of String(s ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// 造型：使用者選過的就用，沒選過的依分頁固定挑一個。
export function lookOf(tab) {
  const picked = shared("office.looks")?.[tab];
  return LOOKS.includes(picked) ? picked : READY_LOOKS[hash(tab) % READY_LOOKS.length];
}

// 畫面上顯示的造型：還沒有 3D 圖的先換成九種之一。
export function shownLook(tab) {
  const look = lookOf(tab);
  return READY_LOOKS.includes(look) ? look : READY_LOOKS[hash(tab) % READY_LOOKS.length];
}

// 衣服：使用者選過的就用，沒選過的依分頁固定挑一套。
export function outfitOf(tab) {
  const picked = shared("office.outfits")?.[tab];
  return OUTFITS.includes(picked) ? picked : OUTFITS[(hash(tab) >>> 3) % OUTFITS.length];
}

// 總經理：右鍵設定的那位；沒設定就找名稱叫 G.M.／GM／總經理 的分頁。設成 "none" 就是不要總經理。
export function findGM(list) {
  const picked = shared("office.gm");
  if (picked === "none") return null;
  return list.find((a) => a.tab && a.tab === picked) ?? list.find((a) => GM_NAME.test((a.tab_name ?? "").trim())) ?? null;
}

// 員工的名字（沒取就是空字串）。
export function nameOf(tab) {
  const n = shared("office.names")?.[tab];
  return typeof n === "string" ? n.trim() : "";
}

export function openLook(tab, name) {
  openOverlay({ mod: "office-look", kind: "popup", width: 520, height: 470, props: { tab, name } });
}

// 最後一段在問你問題嗎？（AI 用文字問完就停下時，Herdr 只會回報「做完了」）
function asksYou(text) {
  const lines = String(text ?? "").split("\n");
  let end = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\s*[✻✳✶✽✢·*]\s+\S.* for \d/.test(lines[i])) { end = i; break; }
  }
  const tail = lines.slice(0, end).map((l) => l.trim())
    .filter((l) => l && !/^[─━╭╰│❯›>⏵]/.test(l) && !/for shortcuts|auto mode|esc to|shift\+tab/i.test(l))
    .slice(-6);
  return tail.some((l) => /？|\?\s*$|\?\s*[）)」』]/.test(l));
}

function icon(p, size) {
  if (!p?.icon) return div().size(size);
  return (p.tint ? svg(p.icon).text_color(p.color ?? C.ink) : image(p.icon)).size(size);
}

function pill(text, bg, fg, border) {
  return div().px(9).py(3).rounded(10).bg(bg).border(2).border_color(border)
    .text_size(11.5).font_weight(700).text_color(fg).whitespace_nowrap().child(text);
}

// 一張圖：r 是 art.js 裡的 [左, 上, 寬, 高]，(x, y) 是它所在框的左上角。
function pic(file, r, x = 0, y = 0) {
  return image(`${ART}${file}.png`).absolute().left(x + r[0]).top(y + r[1]).w(r[2]).h(r[3]);
}

// 地上的多邊形（地毯、地板格線）。點的座標以 (x, y) 為原點。
function floorShape(path, color, x, y, w, h) {
  return window.paint_path(path, color).absolute().left(x).top(y).w(w).h(h);
}

// 一排座位底下的地毯：等角的平行四邊形，長邊沿座位排的方向（右下），短邊往右上。
function rugPoints(cols) {
  const u = (cols - 1) * STEP_X + 82, v = 72;
  const a = [-16, 100];
  return [a, [a[0] + u, a[1] + u / 2], [a[0] + u + v, a[1] + u / 2 - v / 2], [a[0] + v, a[1] - v / 2]];
}

export default class Office extends View {
  init(_props, cx) {
    this.size = { width: 1200, height: 430 };
    this.placeAt = {};
    this.walkUntil = {};
    this.asks = {};
    this.reading = {};
    if (props()?.role) return;
    cx.timer.every(800, (cx) => {
      const now = Date.now();
      let redraw = Object.values(this.walkUntil).some((t) => t > now - 900);
      // 剛做完的員工：讀他畫面的最後一段，看是在交差還是在問你。
      for (const a of agents()) {
        if (a.status !== "done" || a.address in this.asks || this.reading[a.address]) continue;
        if (this.gm && a.address !== this.gm.address) continue;
        this.reading[a.address] = true;
        cx.spawn(async (cx) => {
          try { const r = await hc(["read", a.address, "--lines", "60"]); this.asks[a.address] = asksYou(r.stdout); }
          catch { this.asks[a.address] = false; }
          delete this.reading[a.address];
          cx.notify();
        });
      }
      if (redraw) cx.notify();
    });
    // 讓快捷鍵或指令列也能開：herdr-app do office.hire（新增員工）、office.look（幫目前的員工換造型）
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "hire") this.hire(spaces().find((s) => s.active)?.id);
        if (c === "look") {
          const pane = panes().find((x) => x.focused);
          const tab = spaces().flatMap((s) => s.tabs).find((t) => t.id === pane?.tab);
          if (tab) openLook(tab.id, tab.name);
        }
        cx.notify();
      }
    });
  }

  hire(space) {
    openOverlay({ mod: "office-hire", kind: "dialog", width: 520, height: 780, props: { space } });
  }

  // 這位員工現在該怎麼表現：work / ask / report / toGM / rest；還沒讀完畫面的先坐著（wait）。
  state(a) {
    if (a.status === "working") return "work";
    if (a.status === "blocked") return "ask";
    if (a.status !== "done") return "rest";
    // 有總經理時，員工做完一律交給總經理；總經理讀完會把它標成看過，員工就回座位。
    if (this.gm && a.address !== this.gm.address) return "toGM";
    return a.address in this.asks ? (this.asks[a.address] ? "ask" : "report") : "wait";
  }

  // 該站在哪裡：自己的座位 seat、總經理桌前 gm、你的辦公桌前 boss。
  placeOf(a) {
    const st = this.state(a);
    return st === "report" ? "boss" : st === "toGM" ? "gm" : "seat";
  }

  // 坐著的姿勢與表情。
  pose(a) {
    const st = this.state(a);
    const pose = st === "ask" ? "raise" : st === "work" ? "work" : "rest";
    return { pose, mood: pose === "raise" ? "call" : pose === "rest" ? "sleep" : "smile" };
  }

  narrow() { return this.size.width < NARROW; }
  top() { return this.narrow() ? 100 : 66; }

  // 排座位：一個空間一區，一位員工一個座位，同一區沿右下斜排，放不下就換行。
  plan(list) {
    const W = this.size.width;
    const room = Math.max(SEAT_W + PAD * 2, W - (this.narrow() ? 0 : BOSS_W) - 32);
    const perRow = Math.max(1, Math.floor((room - PAD * 2 - SEAT_W - RUG_X) / STEP_X) + 1);
    const local = spaces().filter((s) => !s.machine);
    const groups = local.map((s) => ({ id: s.id, name: s.name, people: [] }));
    for (const a of list) {
      let g = groups.find((x) => x.id === a.space);
      if (!g) { g = { id: a.space, name: a.space_name, people: [] }; groups.push(g); }
      g.people.push(a);
    }
    const zones = [], seats = {};
    let x = 16, y = this.top(), rowH = 0;
    for (const g of groups) {
      const n = g.people.length;
      const cols = Math.min(n, perRow), rows = Math.ceil(n / perRow);
      // 沒有員工的分區縮成一小塊，只放「＋ 新增員工」。
      const w = n ? PAD * 2 + (cols - 1) * STEP_X + SEAT_W + RUG_X : 168;
      // 最後一排只要放得下名牌和地毯；前面的排要留空間，不然後一排的頭會擋到前一排的名牌。
      const h = n ? ZONE_HEAD + (cols - 1) * STEP_Y + (rows - 1) * ROW_H + LAST_ROW_H : 80;
      if (x > 16 && x + w > 16 + room) { x = 16; y += rowH + GAP; rowH = 0; }
      zones.push({ ...g, x, y, w, h, cols, rows });
      g.people.forEach((a, i) => {
        const c = i % perRow, r = Math.floor(i / perRow);
        seats[a.address] = { x: x + PAD + c * STEP_X, y: y + ZONE_HEAD + c * STEP_Y + r * ROW_H };
      });
      x += w + GAP;
      rowH = Math.max(rowH, h);
    }
    return { zones, seats };
  }

  // 你的辦公桌（含大皮椅）的左上角。寬的時候在右下，窄的時候在下方右邊。
  bossPos() {
    const W = this.size.width, H = this.size.height;
    return this.narrow() ? { x: W - BOSS[0] - 12, y: H - BOSS[1] - 46 } : { x: W - BOSS_W + 20, y: H - BOSS[1] - 70 };
  }

  // 交差的人站在你的辦公桌左前方排隊：沿著桌子前緣排，一排四人，後面的往左上退。
  slot(k) {
    const b = this.bossPos();
    const row = Math.min(Math.floor(k / 4), 2), col = k % 4;
    return this.standAt({ x: b.x + 2 + col * 34 - row * 30, y: b.y + 158 + col * 13 - row * 28 });
  }

  // 總經理的桌子：寬的時候在右上，窄的時候在下方、你的辦公桌左邊。
  gmDeskPos() {
    const W = this.size.width, H = this.size.height;
    if (this.narrow()) return { x: Math.max(16, W - BOSS[0] - 12 - GM.frame[0] - 64), y: H - GM.frame[1] - 66 };
    return { x: W - BOSS_W + 50, y: Math.min(this.top() + 40, this.bossPos().y - GM.frame[1] - 60) };
  }

  // 總經理桌前排隊：站在桌子左前方，一排三人、最多兩排，再多就疊在後排。
  gmSlot(k) {
    const d = this.gmDeskPos();
    const row = Math.min(Math.floor(k / 3), 1), col = k % 3;
    return this.standAt({ x: d.x - 34 + col * 30 - row * 28, y: d.y + 112 + col * 15 - row * 24 });
  }

  // 站著的人：給腳的位置，回傳人像框的左上角。
  standAt(feet) {
    return { x: feet.x - STAND[0] / 2, y: feet.y - STAND[1] };
  }

  // 坐在座位上的人頭上那一格（泡泡的位置，起身時也從這裡走出去）。o 是座位框的左上角。
  sitAt(o) {
    return { x: o.x + 40, y: o.y - 2 };
  }

  // 坐著的人：身體、打字的手、頭。o 是座位框的左上角；桌子要畫在身體和手之間，所以分開回傳。
  seated(a, o) {
    const tab = a.tab ?? a.address, color = shirt(a), outfit = outfitOf(tab), look = shownLook(tab);
    const { pose, mood } = this.pose(a);
    const S = ART3.seat, neck = S.neck[`${outfit}-${pose}`];
    return {
      pose,
      body: pic(`body-${outfit}-${pose}-${color}`, S.rect[`body-${outfit}-${pose}`], o.x, o.y),
      hands: pose === "work" ? pic(`hands-${outfit}-${color}`, S.rect[`hands-${outfit}`], o.x, o.y) : null,
      head: pic(`head-${look}-${mood}`, ART3.head[look], o.x + neck[0], o.y + neck[1]),
    };
  }

  // 站著的人（走路、排隊）：身體加微笑的頭。
  standing(a) {
    const tab = a.tab ?? a.address, outfit = outfitOf(tab), look = shownLook(tab);
    const neck = ART3.stand.neck[outfit];
    return div().relative().w(STAND[0]).h(STAND[1])
      .child(pic(`body-${outfit}-stand-${shirt(a)}`, ART3.stand.rect[`body-${outfit}`]))
      .child(pic(`head-${look}-smile`, ART3.head[look], neck[0], neck[1]));
  }

  // 一位員工：站著的人整個畫在這裡；坐著的人畫在座位裡（seat / gmDesk），這裡只放頭上的泡泡。
  person(a, seat, k, now) {
    const st = this.state(a), place = this.placeOf(a);
    const walking = (this.walkUntil[a.address] ?? 0) > now;
    const queued = place !== "seat";
    const standing = queued || walking;
    const spot = place === "boss" ? this.slot(k) : place === "gm" ? this.gmSlot(k) : this.sitAt(seat);
    const body = standing ? this.standing(a).id(`body-${a.address}`) : div().id(`body-${a.address}`).w(STAND[0]).h(60);
    if (walking) body.loop("top", { from: 0, to: -3, period: 380 });
    let bubble = null;
    // 只有一個人交差時才冒泡泡；人多時看上方的「N 份報告等你看」。
    if (place === "boss" && !walking) bubble = this.doneCount === 1 ? pill("報告好了", "#EAF7EF", C.green, "#8CCBA6") : null;
    else if (st === "ask") bubble = pill(a.status === "blocked" ? "需要你！" : a === this.gm ? "要你決定" : "有事問你", "#FFF1E4", C.orange, "#F0A46C");
    else if (st === "work" && !walking) bubble = div().w(34).h(20).rounded(10).bg("#FFFFFF").border(2).border_color("#D9CDBB")
      .flex().items_center().justify_center().text_size(13).font_weight(800).text_color(C.muted).frames(["·", "··", "···"], 420);
    // 坐著時泡泡放在頭旁邊（打字的點點在右邊、舉手問你在左邊），不會蓋到區名；站著時放在頭上。
    const side = standing ? null : st === "work" ? "right" : st === "ask" ? "left" : null;
    const tag = !bubble ? null : side === "right"
      ? div().id(`tag-${a.address}`).absolute().top(6).left(56).child(bubble)
      : side === "left"
        ? div().id(`tag-${a.address}`).absolute().top(8).left(-76).w(74).flex().justify_end().child(bubble)
        : div().id(`tag-${a.address}`).absolute().top(-24).left(STAND[0] / 2 - 42).w(84).flex().justify_center().child(bubble);
    if (tag && st === "ask") tag.loop("top", side === "left" ? { from: 8, to: 2, period: 700 } : { from: -22, to: -28, period: 700 });
    return div().id(`p-${a.address}`).absolute().left(spot.x).top(spot.y).cursor_pointer()
      .transition("left", { duration: WALK_MS, easing: "ease-in-out" })
      .transition("top", { duration: WALK_MS, easing: "ease-in-out" })
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openLook(a.tab ?? a.address, a.tab_name); })
      .child(body).when(Boolean(tag), (el) => el.child(tag));
  }

  // 一個座位：椅子、人（在座位上時）、桌子、打字的手、頭，照這個順序疊；下面是名牌。
  seat(a, seat) {
    const S = ART3.seat, tab = a.tab ?? a.address;
    const here = this.placeOf(a) === "seat" && !((this.walkUntil[a.address] ?? 0) > Date.now());
    const p = here ? this.seated(a, { x: 0, y: 0 }) : null;
    const desk = p?.pose === "rest" ? "desk-mug" : "desk";
    const role = a.tab_name || a.program?.name || "員工";
    const person = nameOf(tab);
    const plate = h_flex().absolute().left(-4).top(118).max_w(STEP_X + 4).px(7).py(2).rounded(8).bg(C.cream)
      .border(1).border_color(C.rugLine).gap(4).items_center().text_color(C.plate)
      .child(icon(a.program, 12))
      .when(Boolean(person), (el) => el.child(div().text_size(11).font_weight(700).truncate().child(person)))
      .child(div().text_size(person ? 9.5 : 11).font_weight(person ? 400 : 700).text_color(person ? C.muted : C.plate).truncate().child(role));
    return div().id(`desk-${a.address}`).absolute().left(seat.x).top(seat.y).w(SEAT_W).h(120).cursor_pointer()
      .child(pic("chair", S.rect.chair))
      .when(Boolean(p), (el) => el.child(p.body))
      .child(pic(desk, S.rect[desk]))
      .when(Boolean(p?.hands), (el) => el.child(p.hands))
      .when(Boolean(p), (el) => el.child(p.head))
      .child(plate)
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openLook(a.tab ?? a.address, a.tab_name); });
  }

  // 總經理的座位：大椅子、人、大桌子，下面是名牌。
  gmDesk(a) {
    const d = this.gmDeskPos(), o = { x: GM.origin[0], y: GM.origin[1] };
    const here = this.placeOf(a) === "seat" && !((this.walkUntil[a.address] ?? 0) > Date.now());
    const p = here ? this.seated(a, o) : null;
    const name = nameOf(a.tab ?? a.address) || (a.tab_name ?? "").trim();
    return div().id("gm-desk").absolute().left(d.x).top(d.y).w(GM.frame[0]).h(GM.frame[1]).cursor_pointer()
      .child(pic("chair-gm", GM.rect["chair-gm"]))
      .when(Boolean(p), (el) => el.child(p.body))
      .child(pic("gm-desk", GM.rect["gm-desk"]))
      .when(Boolean(p?.hands), (el) => el.child(p.hands))
      .when(Boolean(p), (el) => el.child(p.head))
      .child(h_flex().absolute().left(48).top(GM.frame[1] - 4).max_w(GM.frame[0] - 40).px(8).py(2).rounded(8).bg(C.cream)
        .border(1).border_color(C.rugLine).gap(4).items_center().text_color(C.plate)
        .child(icon(a.program, 12))
        .child(div().text_size(11).font_weight(700).truncate().child(!name || GM_NAME.test(name) ? "總經理" : `總經理・${name}`)))
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openLook(a.tab ?? a.address, a.tab_name); });
  }

  header(list) {
    const count = (st) => list.filter((a) => this.state(a) === st).length;
    const chip = (st, color) => h_flex().gap(5).items_center()
      .child(div().size(8).rounded(4).bg(color)).child(div().child(`${WORD[st]} ${count(st)}`));
    const chips = h_flex().gap(14).text_size(12).text_color(C.ink)
      .child(chip("work", "#5B8DEF")).child(chip("ask", C.orange))
      .when(Boolean(this.gm), (el) => el.child(chip("toGM", "#C9A227")))
      .child(chip("report", C.green)).child(chip("rest", "#A99C8C"));
    const top = h_flex().items_center().gap(16)
      .child(div().text_size(22).font_weight(800).child("辦公室"))
      .child(div().text_size(12.5).text_color(C.muted).child(`${list.length} 位員工`))
      .child(div().flex_1());
    if (this.narrow()) return v_flex().absolute().left(20).top(12).right(16).gap(12).text_color(C.ink)
      .child(this.buttons(top.gap(12))).child(chips);
    return this.buttons(top.absolute().left(20).top(14).right(16).text_color(C.ink).child(chips));
  }

  buttons(row) {
    return row
      .child(div().id("to-classic").px(12).py(6).rounded(8).border(1).border_color(C.rugLine).bg(C.cream)
        .text_color(C.plate).text_size(12.5).font_weight(600).cursor_pointer().hover((s) => s.bg("#FFFFFF"))
        .on_click(() => run("layout.switch", { name: layouts().includes("classic") ? "classic" : "main" })).child("原本畫面"))
      .child(div().id("hire").px(12).py(6).rounded(8).bg(C.wood).text_color(C.cream).text_size(12.5).font_weight(700).cursor_pointer()
        .hover((s) => s.opacity(0.88)).on_click(() => this.hire(spaces().find((s) => s.active)?.id)).child("＋ 新增員工"));
  }

  boss() {
    const b = this.bossPos();
    return div().id("boss-desk").absolute().left(b.x).top(b.y).w(BOSS[0]).h(BOSS[1])
      .child(pic("boss-desk", [0, 0, BOSS[0], BOSS[1]]))
      .child(div().absolute().left(104).top(BOSS[1] - 30).px(9).py(2).rounded(8).bg(C.cream).border(1).border_color(C.rugLine)
        .text_size(11.5).font_weight(700).text_color(C.plate).child("你的辦公桌"));
  }

  waitingNote(waiting) {
    const b = this.bossPos();
    return div().absolute().left(b.x).top(b.y - 20).w(BOSS[0]).flex().justify_center()
      .text_size(12).font_weight(waiting ? 700 : 400).text_color(waiting ? C.green : C.muted)
      .child(waiting ? `${waiting} 份報告等你看` : "目前沒有人在等你");
  }

  // 地板：淡淡的等角格線（2:1 的菱形）。
  floor(top) {
    const W = this.size.width, H = this.size.height, h = H - top, tile = 104;
    let path = PathBuilder.stroke(1);
    for (let x = -2 * h; x < W; x += tile) path = path.move_to(x, 0).line_to(x + 2 * h, h);
    for (let x = 0; x < W + 2 * h; x += tile) path = path.move_to(x, 0).line_to(x - 2 * h, h);
    return floorShape(path.build(), C.floorLine, 0, top, W, h);
  }

  // 一區：每排座位底下一塊斜的地毯，左上角寫區名。
  zone(z) {
    const rugs = [];
    for (let r = 0; r < z.rows; r++) {
      const cols = Math.min(z.cols, z.people.length - r * z.cols);
      const pts = rugPoints(cols).map(([x, y]) => [x + PAD + 16, y + ZONE_HEAD + r * ROW_H]);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const ox = Math.min(...xs), oy = Math.min(...ys), w = Math.max(...xs) - ox, h = Math.max(...ys) - oy;
      const local = pts.map(([x, y]) => [x - ox, y - oy]);
      rugs.push(floorShape(PathBuilder.fill().add_polygon(local).build(), C.rug, ox, oy, w, h));
      rugs.push(floorShape(PathBuilder.stroke(1.2).add_polygon(local, true).build(), C.rugLine, ox, oy, w, h));
    }
    return div().id(`zone-${z.id}`).absolute().left(z.x - 16).top(z.y).w(z.w + 16).h(z.h).cursor_pointer()
      .on_click(() => run("space.select", { id: z.id }))
      .children(rugs)
      .child(h_flex().absolute().left(PAD + 12).top(6).gap(6).items_center()
        .child(div().text_size(13).font_weight(800).text_color(C.ink).child(z.name))
        .child(div().text_size(11).text_color(C.muted).child(z.people.length ? `${z.people.length} 人` : "還沒有人")))
      .when(!z.people.length, (el) => el.child(div().id(`empty-${z.id}`).absolute().left(PAD + 16).top(34).w(z.w - PAD * 2).h(30).rounded(8)
        .border(1).border_dashed().border_color("#C4A97F").flex().items_center().justify_center()
        .text_size(12).font_weight(600).text_color(C.muted).cursor_pointer().hover((s) => s.bg("#EFE2CB"))
        .on_click(() => this.hire(z.id)).child("＋ 新增員工")));
  }

  // 新增員工時選的造型和衣服：等新分頁出現後記到它身上。
  claimLooks(list) {
    const pending = shared("office.pendingLook");
    if (!pending) return;
    if (Date.now() - (pending.at ?? 0) > 120000) { setShared("office.pendingLook", null); return; }
    const looks = shared("office.looks") ?? {};
    const a = list.find((x) => x.space === pending.space && x.tab_name === pending.name && x.tab && !(x.tab in looks));
    if (!a) return;
    setShared("office.looks", { ...looks, [a.tab]: pending.look });
    if (pending.outfit) setShared("office.outfits", { ...(shared("office.outfits") ?? {}), [a.tab]: pending.outfit });
    if (pending.person) setShared("office.names", { ...(shared("office.names") ?? {}), [a.tab]: pending.person });
    setShared("office.pendingLook", null);
  }

  render() {
    const p = props() ?? {};
    if (p.role === "rail") return this.rail();
    if (p.role === "pane") return this.paneHeader(p.pane);

    const now = Date.now();
    const list = agents();
    const gm = this.gm = findGM(list);
    this.claimLooks(list);
    for (const a of list) {
      if (a.status !== "done") delete this.asks[a.address];
      const place = this.placeOf(a);
      if (a.address in this.placeAt && this.placeAt[a.address] !== place) this.walkUntil[a.address] = now + WALK_MS;
      this.placeAt[a.address] = place;
    }
    // 總經理不坐在分區裡，坐總經理桌。
    const staff = list.filter((a) => a !== gm);
    const { zones, seats } = this.plan(staff);
    if (gm) { const d = this.gmDeskPos(); seats[gm.address] = { x: d.x + GM.origin[0], y: d.y + GM.origin[1] }; }
    const order = [...(gm ? [gm] : []), ...zones.flatMap((z) => staff.filter((a) => a.space === z.id))];
    setAgentOrder(order.map((a) => a.address));
    const walking = (a) => (this.walkUntil[a.address] ?? 0) > now;
    const toBoss = order.filter((a) => this.placeOf(a) === "boss");
    const toGM = order.filter((a) => this.placeOf(a) === "gm");
    const k = (a) => Math.max(0, (this.placeOf(a) === "gm" ? toGM : toBoss).indexOf(a));
    const still = (a) => this.placeOf(a) === "seat" && !walking(a);
    this.doneCount = toBoss.length;
    // 站著的人照腳的位置由後往前畫，前面的人擋住後面的人。
    const up = order.filter((a) => !still(a)).map((a) => ({ a, el: this.person(a, seats[a.address], k(a), now) }));
    const feetY = (a) => (this.placeOf(a) === "boss" ? this.slot(k(a)) : this.placeOf(a) === "gm" ? this.gmSlot(k(a)) : this.sitAt(seats[a.address])).y;
    up.sort((x, y) => feetY(x.a) - feetY(y.a));
    const wallH = this.narrow() ? 86 : 54;

    return div().id("office").relative().size_full().overflow_hidden().bg(C.floor)
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .child(this.floor(wallH + 4))
      .child(div().absolute().left(0).top(0).right(0).h(wallH).bg(C.wall))
      .child(div().absolute().left(0).top(wallH).right(0).h(4).bg(C.skirting))
      .children(zones.map((z) => this.zone(z)))
      .children(zones.flatMap((z) => z.people.map((a) => this.seat(a, seats[a.address]))))
      .when(Boolean(gm), (el) => el.child(this.gmDesk(gm)))
      .child(this.boss())
      .children(order.filter(still).map((a) => this.person(a, seats[a.address], 0, now)))
      .children(up.map((x) => x.el))
      .when(!gm, (el) => el.child(this.waitingNote(toBoss.length)))
      .child(this.header(list));
  }

  rail() {
    const s = spaces().find((x) => x.active), tab = s?.tabs.find((t) => t.active);
    return h_flex().size_full().bg(C.wood).px(16).items_center().justify_between().text_color(C.cream).text_size(13).font_weight(600)
      .child(div().child(`${s?.name ?? ""}　／　${tab?.name ?? ""}${tab && nameOf(tab.id) ? `・${nameOf(tab.id)}` : ""}`))
      .child(div().text_size(11.5).opacity(0.8).child("工作畫面"));
  }

  paneHeader(id) {
    const pane = panes().find((x) => x.pane === id);
    const st = pane?.status;
    const word = { working: "工作中", blocked: "需要你", done: "做完了", idle: "休息中" }[st] ?? "";
    const tabName = spaces().flatMap((s) => s.tabs).find((t) => t.id === pane?.tab)?.name;
    const person = pane?.tab ? nameOf(pane.tab) : "";
    return h_flex().size_full().px(12).gap(8).items_center().bg("#E9DCC6").text_color(C.plate).text_size(12).font_weight(600)
      .when(Boolean(person), (el) => el.child(div().font_weight(800).child(person)).child(div().text_color(C.muted).child("·")))
      .child(icon(pane?.program, 15)).child(div().child(pane?.program?.name ?? "終端機"))
      .child(div().flex_1())
      .when(Boolean(st && pane?.tab), (el) => el.child(div().id(`look-${id}`).px(8).py(2).rounded(6).border(1).border_color("#CDB896")
        .text_size(11.5).cursor_pointer().hover((s) => s.bg("#F6EEDF"))
        .on_click(() => openLook(pane.tab, tabName)).child("取名・換造型")))
      .child(div().text_color(st === "blocked" ? C.orange : st === "done" ? C.green : C.muted).child(word));
  }
}
