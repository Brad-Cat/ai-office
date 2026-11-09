// 辦公室：每個 AI 是一位坐在座位上的員工。
// 工作中在打字；要你回答時舉手（卡住等你，或做完時最後在問你問題）；
// 做完交差時走到你的辦公桌前等你看報告；閒置時靠著椅背休息。
// 點員工打開他的工作畫面（下方的終端機）；右鍵或工作畫面標頭的「換造型」可以換人物或動物。
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, spaces, panes, props, run, setAgentOrder, openOverlay, nextCommand, layouts, shared, setShared, hc } from "herdr";

const ART = "mods/office/";
const C = {
  wall: "#F4ECDF", floor: "#EADCC4", rug: "#E3CFAE", rugLine: "#D4BB93",
  ink: "#3D3731", muted: "#7A6E62", wood: "#7E5B3E", plate: "#5A4330",
  cream: "#FFF9EE", orange: "#E07B39", green: "#3E9B6A",
};
const SEAT_W = 120, SEAT_H = 130, PAD = 12, ZONE_HEAD = 44, GAP = 14, TOP = 66, BOSS_W = 250, WALK_MS = 2400;
const WORD = { work: "工作中", ask: "要你回答", report: "報告好了", rest: "休息中" };
export const LOOKS = ["short", "long", "bun", "curly", "bob", "ponytail", "beard", "glasses", "cap", "cat", "dog", "rabbit", "bear", "panda", "fox", "tiger", "lion", "koala", "penguin", "monkey", "frog"];
// 沒選過造型的員工從原本這九種裡固定挑一個，加新造型時大家不會突然換臉。
const DEFAULT_LOOKS = ["short", "long", "bun", "cat", "dog", "rabbit", "bear", "panda", "fox"];
export const LOOK_NAME = { short: "短髮", long: "長髮", bun: "包頭", curly: "捲髮", bob: "鮑伯頭", ponytail: "馬尾", beard: "大鬍子", glasses: "眼鏡", cap: "棒球帽", cat: "貓", dog: "狗", rabbit: "兔子", bear: "熊", panda: "貓熊", fox: "狐狸", tiger: "老虎", lion: "獅子", koala: "無尾熊", penguin: "企鵝", monkey: "猴子", frog: "青蛙" };

// 衣服顏色看是哪家 AI：橘色 Claude、藍色 Codex。
function shirt(a) {
  const app = `${a.app ?? ""} ${a.program?.name ?? ""}`.toLowerCase();
  return app.includes("claude") ? "claude" : app.includes("codex") ? "codex" : "other";
}

// 造型：使用者選過的就用，沒選過的依分頁固定挑一個。
export function lookOf(tab) {
  const picked = shared("office.looks")?.[tab];
  if (LOOKS.includes(picked)) return picked;
  let h = 0;
  for (const ch of String(tab ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return DEFAULT_LOOKS[h % DEFAULT_LOOKS.length];
}

export function openLook(tab, name) {
  openOverlay({ mod: "office-look", kind: "popup", width: 520, height: 300, props: { tab, name } });
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

export default class Office extends View {
  init(_props, cx) {
    this.size = { width: 1200, height: 430 };
    this.atBoss = {};
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
    openOverlay({ mod: "office-hire", kind: "dialog", width: 520, height: 610, props: { space } });
  }

  // 這位員工現在該怎麼表現：work / ask / report / rest；還沒讀完畫面的先坐著（wait）。
  state(a) {
    if (a.status === "working") return "work";
    if (a.status === "blocked") return "ask";
    if (a.status === "done") return a.address in this.asks ? (this.asks[a.address] ? "ask" : "report") : "wait";
    return "rest";
  }

  // 排座位：一個空間一區，一位員工一張桌子，放不下就換行。
  plan(list) {
    const W = this.size.width;
    const room = Math.max(SEAT_W + PAD * 2, W - BOSS_W - 32);
    const perRow = Math.max(1, Math.floor((room - PAD * 2) / SEAT_W));
    const local = spaces().filter((s) => !s.machine);
    const groups = local.map((s) => ({ id: s.id, name: s.name, people: [] }));
    for (const a of list) {
      let g = groups.find((x) => x.id === a.space);
      if (!g) { g = { id: a.space, name: a.space_name, people: [] }; groups.push(g); }
      g.people.push(a);
    }
    const zones = [], seats = {};
    let x = 16, y = TOP, rowH = 0;
    for (const g of groups) {
      const n = g.people.length;
      const cols = Math.min(n, perRow), rows = Math.ceil(n / perRow);
      // 沒有員工的分區縮成一小塊，只放「＋ 新增員工」。
      const w = n ? PAD * 2 + cols * SEAT_W : 168, h = n ? ZONE_HEAD + rows * SEAT_H + 6 : 80;
      if (x > 16 && x + w > 16 + room) { x = 16; y += rowH + GAP; rowH = 0; }
      zones.push({ ...g, x, y, w, h });
      g.people.forEach((a, i) => {
        seats[a.address] = { x: x + PAD + (i % perRow) * SEAT_W, y: y + ZONE_HEAD + Math.floor(i / perRow) * SEAT_H };
      });
      x += w + GAP;
      rowH = Math.max(rowH, h);
    }
    return { zones, seats };
  }

  // 你的辦公桌前的位置：交差的人在這裡排隊等你。
  slot(k) {
    const W = this.size.width, H = this.size.height;
    const bx = W - BOSS_W + 14, deskTop = H - 118;
    const row = Math.floor(k / 3), col = k % 3;
    return { x: bx + 44 + col * 56 + row * 28, y: deskTop - 30 - row * 22 };
  }

  person(a, seat, k, now) {
    const st = this.state(a), color = shirt(a), look = lookOf(a.tab ?? a.address);
    const walking = (this.walkUntil[a.address] ?? 0) > now;
    const atBoss = st === "report";
    const standing = atBoss || walking;
    const spot = atBoss ? this.slot(k) : standing ? { x: seat.x + 36, y: seat.y + 2 } : { x: seat.x + 20, y: seat.y + 8 };
    const pose = standing ? "stand" : st === "ask" ? "raise" : st === "work" ? "work" : "rest";
    const mood = pose === "raise" ? "call" : pose === "rest" ? "sleep" : "smile";
    const body = div().id(`body-${a.address}`).relative().w(standing ? 48 : 80).h(80)
      .child(image(`${ART}body-${pose}-${color}.svg`).w(standing ? 48 : 80).h(80))
      .child(standing
        ? image(`${ART}head-${look}-${mood}.svg`).absolute().left(6.3).top(-6.5).size(35.4)
        : image(`${ART}head-${look}-${mood}.svg`).absolute().left(20).top(5).size(40));
    if (walking) body.loop("top", { from: 0, to: -3, period: 380 });
    let bubble = null;
    if (atBoss && !walking) bubble = pill("報告好了", "#EAF7EF", C.green, "#8CCBA6");
    else if (st === "ask") bubble = pill(a.status === "blocked" ? "需要你！" : "有事問你", "#FFF1E4", C.orange, "#F0A46C");
    else if (st === "work" && !walking) bubble = div().w(34).h(20).rounded(10).bg("#FFFFFF").border(2).border_color("#D9CDBB")
      .flex().items_center().justify_center().text_size(13).font_weight(800).text_color(C.muted).frames(["·", "··", "···"], 420);
    const lift = atBoss ? 24 + (k % 2) * 22 : 20;
    const beside = st === "work" && !standing;
    const tag = !bubble ? null : beside
      ? div().id(`tag-${a.address}`).absolute().top(6).left(60).child(bubble)
      : div().id(`tag-${a.address}`).absolute().top(-lift).left(standing ? -18 : 6).w(standing ? 84 : 68).flex().justify_center().child(bubble);
    if (tag && st === "ask") tag.loop("top", { from: -20, to: -26, period: 700 });
    return div().id(`p-${a.address}`).absolute().left(spot.x).top(spot.y).cursor_pointer()
      .transition("left", { duration: WALK_MS, easing: "ease-in-out" })
      .transition("top", { duration: WALK_MS, easing: "ease-in-out" })
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openLook(a.tab ?? a.address, a.tab_name); })
      .child(body).when(Boolean(tag), (el) => el.child(tag));
  }

  desk(a, seat) {
    const empty = !a;
    const st = a ? this.state(a) : null;
    const el = div().id(`desk-${a?.address ?? seat.space}`).absolute().left(seat.x).top(seat.y + 56).w(SEAT_W).h(70).cursor_pointer()
      .child(image(`${ART}${empty ? "desk-empty" : st === "rest" ? "desk-mug" : "desk"}.svg`).w(SEAT_W).h(70))
      .child(div().absolute().left(22).top(42).w(76).h(18).flex().items_center().justify_center()
        .text_size(11).font_weight(700).text_color(empty ? C.muted : C.plate).truncate().child(empty ? "＋ 新增員工" : a.tab_name || a.program?.name || "員工"));
    if (empty) return el.opacity(0.6).hover((s) => s.opacity(0.9)).on_click(() => this.hire(seat.space));
    return el.child(div().absolute().left(52).top(6).child(icon(a.program, 16)))
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openLook(a.tab ?? a.address, a.tab_name); });
  }

  header(list) {
    const count = (st) => list.filter((a) => this.state(a) === st).length;
    const chip = (st, color) => h_flex().gap(5).items_center()
      .child(div().size(8).rounded(4).bg(color)).child(div().child(`${WORD[st]} ${count(st)}`));
    return h_flex().absolute().left(20).top(14).right(16).items_center().gap(16).text_color(C.ink)
      .child(div().text_size(22).font_weight(800).child("辦公室"))
      .child(div().text_size(12.5).text_color(C.muted).child(`${list.length} 位員工`))
      .child(div().flex_1())
      .child(h_flex().gap(14).text_size(12).text_color(C.ink)
        .child(chip("work", "#5B8DEF")).child(chip("ask", C.orange)).child(chip("report", C.green)).child(chip("rest", "#A99C8C")))
      .child(div().id("to-classic").px(12).py(6).rounded(8).border(1).border_color(C.rugLine).bg(C.cream)
        .text_color(C.plate).text_size(12.5).font_weight(600).cursor_pointer().hover((s) => s.bg("#FFFFFF"))
        .on_click(() => run("layout.switch", { name: layouts().includes("classic") ? "classic" : "main" })).child("原本畫面"))
      .child(div().id("hire").px(12).py(6).rounded(8).bg(C.wood).text_color(C.cream).text_size(12.5).font_weight(700).cursor_pointer()
        .hover((s) => s.opacity(0.88)).on_click(() => this.hire(spaces().find((s) => s.active)?.id)).child("＋ 新增員工"));
  }

  boss() {
    const W = this.size.width, H = this.size.height;
    const bx = W - BOSS_W + 14, deskTop = H - 118;
    return div().absolute().left(bx).top(deskTop).w(200).h(96)
      .child(image(`${ART}boss-desk.svg`).w(200).h(96))
      .child(div().absolute().left(50).top(58).w(100).h(22).flex().items_center().justify_center()
        .text_size(11.5).font_weight(700).text_color(C.plate).child("你的辦公桌"));
  }

  waitingNote(waiting) {
    const bx = this.size.width - BOSS_W + 14;
    return div().absolute().left(bx).top(TOP + 4).w(200).flex().justify_center()
      .text_size(12).font_weight(waiting ? 700 : 400).text_color(waiting ? C.green : C.muted)
      .child(waiting ? `${waiting} 份報告等你看` : "目前沒有人在等你");
  }

  // 新增員工時選的造型：等新分頁出現後記到它身上。
  claimLooks(list) {
    const pending = shared("office.pendingLook");
    if (!pending) return;
    if (Date.now() - (pending.at ?? 0) > 120000) { setShared("office.pendingLook", null); return; }
    const looks = shared("office.looks") ?? {};
    const a = list.find((x) => x.space === pending.space && x.tab_name === pending.name && x.tab && !(x.tab in looks));
    if (!a) return;
    setShared("office.looks", { ...looks, [a.tab]: pending.look });
    setShared("office.pendingLook", null);
  }

  render() {
    const p = props() ?? {};
    if (p.role === "rail") return this.rail();
    if (p.role === "pane") return this.paneHeader(p.pane);

    const now = Date.now();
    const list = agents();
    this.claimLooks(list);
    for (const a of list) {
      if (a.status !== "done") delete this.asks[a.address];
      const boss = this.state(a) === "report";
      if (a.address in this.atBoss && this.atBoss[a.address] !== boss) this.walkUntil[a.address] = now + WALK_MS;
      this.atBoss[a.address] = boss;
    }
    const { zones, seats } = this.plan(list);
    const order = zones.flatMap((z) => list.filter((a) => a.space === z.id));
    setAgentOrder(order.map((a) => a.address));
    const done = order.filter((a) => this.state(a) === "report");
    const seated = order.filter((a) => this.state(a) !== "report" && !((this.walkUntil[a.address] ?? 0) > now));
    const moving = order.filter((a) => !seated.includes(a));

    return div().id("office").relative().size_full().overflow_hidden().bg(C.floor)
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .child(div().absolute().left(0).top(0).right(0).h(54).bg(C.wall))
      .child(div().absolute().left(0).top(54).right(0).h(3).bg("#D9C7A8"))
      .children(zones.map((z) => div().id(`zone-${z.id}`).absolute().left(z.x).top(z.y).w(z.w).h(z.h)
        .rounded(12).bg(C.rug).border(1).border_color(C.rugLine).cursor_pointer()
        .on_click(() => run("space.select", { id: z.id }))
        .child(h_flex().absolute().left(12).top(7).gap(6).items_center()
          .child(div().text_size(13).font_weight(800).text_color(C.ink).child(z.name))
          .child(div().text_size(11).text_color(C.muted).child(z.people.length ? `${z.people.length} 人` : "還沒有人")))))
      .children(seated.map((a) => this.person(a, seats[a.address], 0, now)))
      .children(zones.flatMap((z) => z.people.length
        ? z.people.map((a) => this.desk(a, seats[a.address]))
        : [div().id(`empty-${z.id}`).absolute().left(z.x + PAD).top(z.y + 36).w(z.w - PAD * 2).h(30).rounded(8)
            .border(1).border_dashed().border_color("#C4A97F").flex().items_center().justify_center()
            .text_size(12).font_weight(600).text_color(C.muted).cursor_pointer().hover((s) => s.bg("#EFE2CB"))
            .on_click(() => this.hire(z.id)).child("＋ 新增員工")]))
      .children(moving.map((a) => this.person(a, seats[a.address], done.indexOf(a), now)))
      .child(this.boss())
      .child(this.waitingNote(done.length))
      .child(this.header(list));
  }

  rail() {
    const s = spaces().find((x) => x.active), tab = s?.tabs.find((t) => t.active);
    return h_flex().size_full().bg(C.wood).px(16).items_center().justify_between().text_color(C.cream).text_size(13).font_weight(600)
      .child(div().child(`${s?.name ?? ""}　／　${tab?.name ?? ""}`))
      .child(div().text_size(11.5).opacity(0.8).child("工作畫面"));
  }

  paneHeader(id) {
    const pane = panes().find((x) => x.pane === id);
    const st = pane?.status;
    const word = { working: "工作中", blocked: "需要你", done: "做完了", idle: "休息中" }[st] ?? "";
    const tabName = spaces().flatMap((s) => s.tabs).find((t) => t.id === pane?.tab)?.name;
    return h_flex().size_full().px(12).gap(8).items_center().bg("#E9DCC6").text_color(C.plate).text_size(12).font_weight(600)
      .child(icon(pane?.program, 15)).child(div().child(pane?.program?.name ?? "終端機"))
      .child(div().flex_1())
      .when(Boolean(st && pane?.tab), (el) => el.child(div().id(`look-${id}`).px(8).py(2).rounded(6).border(1).border_color("#CDB896")
        .text_size(11.5).cursor_pointer().hover((s) => s.bg("#F6EEDF"))
        .on_click(() => openLook(pane.tab, tabName)).child("換造型")))
      .child(div().text_color(st === "blocked" ? C.orange : st === "done" ? C.green : C.muted).child(word));
  }
}
