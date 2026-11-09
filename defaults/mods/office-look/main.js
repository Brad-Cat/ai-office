// 換造型：九種人物和動物，點一下就換；造型存在 shared("office.looks")，以分頁為單位。
import { View, div, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { props, closeOverlay, theme, shared, setShared } from "herdr";

const LOOKS = ["short", "long", "bun", "cat", "dog", "rabbit", "bear", "panda", "fox"];
const NAME = { short: "短髮", long: "長髮", bun: "包頭", cat: "貓", dog: "狗", rabbit: "兔子", bear: "熊", panda: "貓熊", fox: "狐狸" };

function current(tab) {
  const picked = shared("office.looks")?.[tab];
  if (LOOKS.includes(picked)) return picked;
  let h = 0;
  for (const ch of String(tab ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LOOKS[h % LOOKS.length];
}

export default class Look extends View {
  init(_p, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
  }
  render() {
    const t = theme();
    const p = props() ?? {};
    const now = current(p.tab);
    const pick = (look) => {
      setShared("office.looks", { ...(shared("office.looks") ?? {}), [p.tab]: look });
      closeOverlay(p.overlay);
    };
    const tile = (look) => v_flex().id(`look-${look}`).w(88).h(92).items_center().justify_center().gap(4).rounded(10).cursor_pointer()
      .border_1().border_color(look === now ? t.accent : t.border).bg(look === now ? t.selected : t.raised)
      .hover((s) => s.bg(t.hover)).on_click(() => pick(look))
      .child(image(`mods/office/head-${look}-smile.svg`).size(52))
      .child(div().text_size(12).text_color(t.foreground).child(NAME[look]));
    const rows = [0, 3, 6].map((i) => h_flex().gap(8).children(LOOKS.slice(i, i + 3).map(tile)));
    return v_flex().id("office-look").track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .w_full().p(14).gap(8).bg(t.popover).text_color(t.foreground)
      .child(div().text_size(13.5).font_semibold().pb(4).child(p.name ? `幫「${p.name}」換造型` : "換造型"))
      .children(rows);
  }
}
