// 辦公室：每個 AI 是一位坐在座位上的員工。
// 工作中在打字、需要你時舉手、做完走到你的辦公桌前等你、閒置時靠著椅背休息。
// 點員工打開他的工作畫面（下方的終端機）；「＋ 新增員工」開一個新的 AI 分頁。
import { View, div, image, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { agents, spaces, panes, props, run, setAgentOrder, openOverlay, nextCommand, layouts } from "herdr";

const ART = "mods/office/";
const C = {
  wall: "#F4ECDF", floor: "#EADCC4", rug: "#E3CFAE", rugLine: "#D4BB93",
  ink: "#3D3731", muted: "#7A6E62", wood: "#7E5B3E", plate: "#5A4330",
  cream: "#FFF9EE", orange: "#E07B39", green: "#3E9B6A",
};
const SEAT_W = 120, SEAT_H = 132, PAD = 12, ZONE_HEAD = 30, GAP = 14, TOP = 66, BOSS_W = 250, WALK_MS = 2400;
const WORD = { working: "工作中", blocked: "需要你", done: "做完了", idle: "休息中" };

function look(a) {
  const app = `${a.app ?? ""} ${a.program?.name ?? ""}`.toLowerCase();
  return app.includes("claude") ? "claude" : app.includes("codex") ? "codex" : "other";
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
    this.prev = {};
    this.walkUntil = {};
    // 只有在有人走路時才重畫，讓走完的人換回坐姿。
    if (props()?.role) return;
    cx.timer.every(800, (cx) => {
      const now = Date.now();
      if (Object.values(this.walkUntil).some((t) => t > now - 900)) cx.notify();
    });
    // 讓快捷鍵或指令列也能開「新增員工」：herdr-app do office.hire
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "hire") this.hire(spaces().find((s) => s.active)?.id);
        cx.notify();
      }
    });
  }

  hire(space) {
    openOverlay({ mod: "office-hire", kind: "dialog", width: 480, height: 430, props: { space } });
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
      const n = Math.max(1, g.people.length);
      const cols = Math.min(n, perRow), rows = Math.ceil(n / perRow);
      const w = PAD * 2 + cols * SEAT_W, h = ZONE_HEAD + rows * SEAT_H + 6;
      if (x > 16 && x + w > 16 + room) { x = 16; y += rowH + GAP; rowH = 0; }
      const zone = { ...g, x, y, w, h };
      zones.push(zone);
      g.people.forEach((a, i) => {
        seats[a.address] = { x: x + PAD + (i % perRow) * SEAT_W, y: y + ZONE_HEAD + Math.floor(i / perRow) * SEAT_H };
      });
      x += w + GAP;
      rowH = Math.max(rowH, h);
    }
    return { zones, seats };
  }

  // 你的辦公桌前的位置：做完的人在這裡排隊等你。
  slot(k) {
    const W = this.size.width, H = this.size.height;
    const bx = W - BOSS_W + 14, deskTop = H - 118;
    const row = Math.floor(k / 3), col = k % 3;
    return { x: bx + 44 + col * 56 + row * 28, y: deskTop - 30 - row * 22 };
  }

  person(a, seat, k, now) {
    const kind = look(a), st = a.status;
    const walking = (this.walkUntil[a.address] ?? 0) > now;
    const atBoss = st === "done";
    const standing = atBoss || walking;
    const spot = atBoss ? this.slot(k) : standing ? { x: seat.x + 36, y: seat.y + 2 } : { x: seat.x + 20, y: seat.y + 8 };
    const pic = standing ? `stand-${kind}` : st === "blocked" ? `raise-${kind}` : st === "working" ? `work-${kind}` : `rest-${kind}`;
    const body = div().id(`body-${a.address}`).relative().w(standing ? 48 : 80).h(80)
      .child(image(`${ART}${pic}.svg`).w(standing ? 48 : 80).h(80));
    if (walking) body.loop("top", { from: 0, to: -3, period: 380 });
    let bubble = null;
    if (atBoss && !walking) bubble = pill("報告好了", "#EAF7EF", C.green, "#8CCBA6");
    else if (st === "blocked") bubble = pill("需要你！", "#FFF1E4", C.orange, "#F0A46C");
    else if (st === "working" && !walking) bubble = div().w(34).h(20).rounded(10).bg("#FFFFFF").border(2).border_color("#D9CDBB")
      .flex().items_center().justify_center().text_size(13).font_weight(800).text_color(C.muted).frames(["·", "··", "···"], 420);
    const lift = atBoss ? 24 + (k % 2) * 22 : 24;
    const tag = bubble ? div().id(`tag-${a.address}`).absolute().top(-lift).left(standing ? -18 : 6).w(standing ? 84 : 68)
      .flex().justify_center().child(bubble) : null;
    if (tag && st === "blocked") tag.loop("top", { from: -24, to: -32, period: 700 });
    return div().id(`p-${a.address}`).absolute().left(spot.x).top(spot.y).cursor_pointer()
      .transition("left", { duration: WALK_MS, easing: "ease-in-out" })
      .transition("top", { duration: WALK_MS, easing: "ease-in-out" })
      .on_click(() => run("agent.focus", { terminal: a.address }))
      .child(body).when(Boolean(tag), (el) => el.child(tag));
  }

  desk(a, seat) {
    const empty = !a;
    const el = div().id(`desk-${a?.address ?? seat.space}`).absolute().left(seat.x).top(seat.y + 56).w(SEAT_W).h(70).cursor_pointer()
      .child(image(`${ART}${empty ? "desk-empty" : a.status === "idle" ? "desk-mug" : "desk"}.svg`).w(SEAT_W).h(70))
      .child(div().absolute().left(22).top(42).w(76).h(18).flex().items_center().justify_center()
        .text_size(11).font_weight(700).text_color(empty ? C.muted : C.plate).truncate().child(empty ? "＋ 新增員工" : a.tab_name || a.program?.name || "員工"));
    if (empty) return el.opacity(0.6).hover((s) => s.opacity(0.9)).on_click(() => this.hire(seat.space));
    return el.child(div().absolute().left(52).top(6).child(icon(a.program, 16)))
      .on_click(() => run("agent.focus", { terminal: a.address }));
  }

  header(list) {
    const count = (st) => list.filter((a) => a.status === st).length;
    const chip = (st, color) => h_flex().gap(5).items_center()
      .child(div().size(8).rounded(4).bg(color)).child(div().child(`${WORD[st]} ${count(st)}`));
    return h_flex().absolute().left(20).top(14).right(16).items_center().gap(16).text_color(C.ink)
      .child(div().text_size(22).font_weight(800).child("辦公室"))
      .child(div().text_size(12.5).text_color(C.muted).child(`${list.length} 位員工`))
      .child(div().flex_1())
      .child(h_flex().gap(14).text_size(12).text_color(C.ink)
        .child(chip("working", "#5B8DEF")).child(chip("blocked", C.orange)).child(chip("done", C.green)).child(chip("idle", "#A99C8C")))
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

  render() {
    const p = props() ?? {};
    if (p.role === "rail") return this.rail();
    if (p.role === "pane") return this.paneHeader(p.pane);

    const now = Date.now();
    const list = agents();
    for (const a of list) {
      const before = this.prev[a.address];
      if (before && before !== a.status && (before === "done" || a.status === "done")) this.walkUntil[a.address] = now + WALK_MS;
      this.prev[a.address] = a.status;
    }
    const { zones, seats } = this.plan(list);
    const order = zones.flatMap((z) => list.filter((a) => a.space === z.id));
    setAgentOrder(order.map((a) => a.address));
    const done = order.filter((a) => a.status === "done");
    const seated = order.filter((a) => a.status !== "done" && !((this.walkUntil[a.address] ?? 0) > now));
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
          .child(div().text_size(11).text_color(C.muted).child(z.people.length ? `${z.people.length} 人` : "空位")))))
      .children(seated.map((a) => this.person(a, seats[a.address], 0, now)))
      .children(zones.flatMap((z) => z.people.length
        ? z.people.map((a) => this.desk(a, seats[a.address]))
        : [this.desk(null, { x: z.x + PAD, y: z.y + ZONE_HEAD, space: z.id })]))
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
    return h_flex().size_full().px(12).gap(8).items_center().bg("#E9DCC6").text_color(C.plate).text_size(12).font_weight(600)
      .child(icon(pane?.program, 15)).child(div().child(pane?.program?.name ?? "終端機"))
      .child(div().flex_1())
      .child(div().text_color(st === "blocked" ? C.orange : st === "done" ? C.green : C.muted).child(st ? WORD[st] : ""));
  }
}
