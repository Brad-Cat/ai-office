// 取名・換造型：上面填名字（shared("office.names")），下面點造型（shared("office.looks")）和衣服（shared("office.outfits")），都以分頁為單位。
// 造型只列已經有 3D 圖的九種；之前選了其他造型的員工，畫面上先顯示成九種之一，原本的選擇不變。
// 名字按 Enter、按「存好」、點造型或離開輸入框時存起來；清空就是不取名。
// 右上角可以把這位設為總經理（shared("office.gm")），或取消。
import { View, div, image } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme, shared, setShared, agents } from "herdr";

const ART = "mods/office/art/";
const LOOKS = ["short", "long", "bun", "cat", "dog", "rabbit", "bear", "panda", "fox"];
const NAME = { short: "短髮", long: "長髮", bun: "包頭", cat: "貓", dog: "狗", rabbit: "兔子", bear: "熊", panda: "貓熊", fox: "狐狸" };
const OUTFITS = ["polo", "hoodie", "cardigan"];
const OUTFIT_NAME = { polo: "Polo 衫", hoodie: "帽 T", cardigan: "針織外套" };

const GM_NAME = /^(g\.?\s*m\.?|總經理)$/i;

// 跟辦公室畫面同一套規則：右鍵設定的優先，沒設定就看名稱。
function gmTab() {
  const picked = shared("office.gm");
  if (picked === "none") return null;
  const list = agents();
  return list.find((a) => a.tab && a.tab === picked)?.tab ?? list.find((a) => GM_NAME.test((a.tab_name ?? "").trim()))?.tab ?? null;
}

function hash(s) {
  let h = 0;
  for (const ch of String(s ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// 跟辦公室畫面一樣：畫面上顯示的造型和衣服。
function current(tab) {
  const picked = shared("office.looks")?.[tab];
  return LOOKS.includes(picked) ? picked : LOOKS[hash(tab) % LOOKS.length];
}

function outfit(tab) {
  const picked = shared("office.outfits")?.[tab];
  return OUTFITS.includes(picked) ? picked : OUTFITS[(hash(tab) >>> 3) % OUTFITS.length];
}

// 衣服顏色看是哪家 AI。
function color(tab) {
  const a = agents().find((x) => x.tab === tab);
  const app = `${a?.app ?? ""} ${a?.program?.name ?? ""}`.toLowerCase();
  return app.includes("claude") ? "claude" : app.includes("codex") ? "codex" : "other";
}

export default class Look extends View {
  init(_p, cx) {
    const p = props() ?? {};
    this.tab = p.tab;
    const name = shared("office.names")?.[p.tab];
    this.person = InputState.new({ value: typeof name === "string" ? name : "", placeholder: "例如：小美" });
    this.person.on("submit", () => { this.save(); closeOverlay(p.overlay); });
    this.person.on("blur", () => this.save());
    this.handle = cx.focus_handle();
    this.person.focus();
    cx.timer.after(400, () => this.person.focus());
  }

  save() {
    const v = this.person.value().trim();
    const names = { ...(shared("office.names") ?? {}) };
    if ((names[this.tab] ?? "") === v) return;
    if (v) names[this.tab] = v; else delete names[this.tab];
    setShared("office.names", names);
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const now = current(p.tab), wear = outfit(p.tab), c = color(p.tab);
    const pick = (look) => {
      this.save();
      setShared("office.looks", { ...(shared("office.looks") ?? {}), [p.tab]: look });
      closeOverlay(p.overlay);
    };
    const dress = (o) => {
      this.save();
      setShared("office.outfits", { ...(shared("office.outfits") ?? {}), [p.tab]: o });
      closeOverlay(p.overlay);
    };
    const tile = (id, picked, w, h, art, size, label, onPick) => v_flex().id(id).w(w).h(h).items_center().justify_center().gap(3).rounded(9).cursor_pointer()
      .border_1().border_color(picked ? t.accent : t.border).bg(picked ? t.selected : t.raised)
      .hover((s) => s.bg(t.hover)).on_click(onPick)
      .child(image(art).w(size[0]).h(size[1]))
      .child(div().text_size(11).text_color(t.foreground).child(label));
    const head = (look) => tile(`look-${look}`, look === now, 88, 74, `${ART}head-${look}-smile.png`, [44, 44], NAME[look], () => pick(look));
    const rows = [0, 5].map((i) => h_flex().gap(6).children(LOOKS.slice(i, i + 5).map(head)));
    const clothes = h_flex().gap(6).children(OUTFITS.map((o) =>
      tile(`outfit-${o}`, o === wear, 88, 96, `${ART}body-${o}-stand-${c}.png`, [36, 70], OUTFIT_NAME[o], () => dress(o))));
    return v_flex().id("office-look").track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .w_full().p(14).gap(8).bg(t.popover).text_color(t.foreground)
      .child(h_flex().pb(4).items_center()
        .child(div().flex_1().text_size(13.5).font_semibold().child(p.name ? `幫「${p.name}」取名、換造型` : "取名、換造型"))
        .child(div().id("gm-toggle").px(10).py(4).rounded(7).border_1().border_color(t.border).bg(t.raised)
          .text_size(12).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => { this.save(); setShared("office.gm", gmTab() === p.tab ? "none" : p.tab); closeOverlay(p.overlay); })
          .child(gmTab() === p.tab ? "不當總經理" : "設為總經理")))
      .child(h_flex().gap(8).items_center()
        .child(div().w(36).text_size(12.5).text_color(t.dim).child("名字"))
        .child(Input.new(this.person).flex_1().h(34).px(10).rounded(8).border_1().border_color(t.input).bg(t.background).text_size(12.8).text_color(t.foreground))
        .child(div().id("name-save").px(12).py(7).rounded(8).bg(t.solid).text_color(t.solid_foreground).text_size(12).cursor_pointer()
          .hover((s) => s.opacity(0.88)).on_click(() => { this.save(); closeOverlay(p.overlay); }).child("存好")))
      .child(div().pt(4).text_size(12.5).text_color(t.dim).child("造型"))
      .children(rows)
      .child(div().pt(4).text_size(12.5).text_color(t.dim).child("衣服（顏色看是哪家 AI）"))
      .child(clothes);
  }
}
