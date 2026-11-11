// 新增員工：填職稱、取名字、選 AI、選造型和衣服、選坐哪一區，按「請他上工」就開一個新的 AI 分頁。
import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { run, props, closeOverlay, theme, spaces, knownAgents, setShared } from "herdr";

const ART = "mods/office/art/";
// 已經有 3D 圖的九種造型、三套衣服（衣服顏色看選哪家 AI）。
const LOOKS = ["short", "long", "bun", "cat", "dog", "rabbit", "bear", "panda", "fox"];
const LOOK_NAME = { short: "短髮", long: "長髮", bun: "包頭", cat: "貓", dog: "狗", rabbit: "兔子", bear: "熊", panda: "貓熊", fox: "狐狸" };
const OUTFITS = ["polo", "hoodie", "cardigan"];
const OUTFIT_NAME = { polo: "Polo 衫", hoodie: "帽 T", cardigan: "針織外套" };

export default class Hire extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.space = p.space ?? spaces().find((s) => s.active)?.id;
    this.agents = [];
    this.agent = null;
    this.loading = true;
    this.look = LOOKS[Math.floor(Math.random() * LOOKS.length)];
    this.outfit = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
    this.title = InputState.new({ value: "" });
    this.person = InputState.new({ value: "", placeholder: "例如：小美" });
    this.task = InputState.new({ value: "" });
    this.focusOn = "title";
    for (const [key, input] of [["title", this.title], ["person", this.person], ["task", this.task]]) {
      input.on("change", (_e, cx) => cx.notify());
      input.on("focus", (_e, cx) => { this.focusOn = key; cx.notify(); });
      input.on("submit", () => this.submit());
    }
    this.title.focus();
    cx.timer.after(600, () => this.title.focus());
    this.handle = cx.focus_handle();
    cx.spawn(async (cx) => {
      try { this.agents = (await knownAgents({})).filter((a) => a.installed); } catch { this.agents = []; }
      this.agent = this.agents.find((a) => /claude/i.test(a.name)) ?? this.agents[0] ?? null;
      this.loading = false;
      cx.notify();
    });
  }

  submit() {
    const name = this.title.value().trim();
    if (!name || !this.agent || !this.space) return;
    const task = this.task.value().trim();
    closeOverlay(props().overlay);
    // 辦公室畫面等新分頁出現後，把這個造型和衣服記到它身上。
    const person = this.person.value().trim();
    setShared("office.pendingLook", { space: this.space, name, look: this.look, outfit: this.outfit, person, at: Date.now() });
    run("tab.new", { space: this.space, name, argv: this.agent.run, ...(task ? { task } : {}) });
  }

  render() {
    const t = theme();
    const p = props() ?? {};
    const label = (text) => div().pt(14).pb(6).text_size(11.5).text_color(t.dim).child(text);
    const field = (key, input) => Input.new(input).h(36).px(10).rounded(9).border_1()
      .border_color(this.focusOn === key ? t.accent : t.input).bg(t.background).text_size(12.8).text_color(t.foreground);
    const choice = (id, picked, content, onPick) => h_flex().id(id).h(30).px(10).gap(6).items_center().rounded(8).cursor_pointer()
      .border_1().border_color(picked ? t.accent : t.input).bg(picked ? t.selected : t.raised)
      .text_size(12.5).text_color(t.foreground).hover((s) => s.opacity(0.88)).on_click((_e, cx) => { onPick(); cx.notify(); }).child(content);
    const agentIcon = (a) => a.icon ? (a.tint ? svg(a.icon).size(14).text_color(t.foreground) : image(a.icon).size(14)) : div().size(14);
    const ready = Boolean(this.title.value().trim() && this.agent && this.space);
    const color = /claude/i.test(this.agent?.name ?? "") ? "claude" : /codex/i.test(this.agent?.name ?? "") ? "codex" : "other";
    const button = (id, text, primary, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium().cursor_pointer()
      .when(primary && !ready, (el) => el.opacity(0.45)).hover((s) => s.opacity(0.88)).on_click(action).child(text);

    return v_flex().id("hire").track_focus(this.handle)
      .on_key_down((e, cx) => { if (e.key === "escape") { closeOverlay(p.overlay); cx.stop_propagation(); } })
      .w_full().min_h(0).p(18).bg(t.popover).text_color(t.foreground)
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().child("新增員工"))
        .child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(label("職稱"))
      .child(field("title", this.title))
      .child(label("名字（可以留空，之後也能在「取名・換造型」改）"))
      .child(field("person", this.person))
      .child(label("交辦的第一件事（可以留空）"))
      .child(field("task", this.task))
      .child(label("用哪個 AI"))
      .child(h_flex().gap(8).flex_wrap()
        .children(this.agents.map((a) => choice(`ai-${a.key}`, this.agent === a, h_flex().gap(6).items_center().child(agentIcon(a)).child(a.name), () => { this.agent = a; })))
        .when(this.agents.length === 0, (el) => el.child(div().text_size(12).text_color(t.dim)
          .child(this.loading ? "正在檢查這台電腦裝了哪些 AI…" : "這台電腦還沒有安裝 Claude Code 或 Codex"))))
      .child(label("造型"))
      .child(h_flex().gap(6).flex_wrap()
        .children(LOOKS.map((look) => v_flex().id(`look-${look}`).w(62).h(56).items_center().justify_center().rounded(8).cursor_pointer()
          .border_1().border_color(this.look === look ? t.accent : t.input).bg(this.look === look ? t.selected : t.raised)
          .hover((s) => s.opacity(0.88)).on_click((_e, cx) => { this.look = look; cx.notify(); })
          .child(image(`${ART}head-${look}-smile.png`).size(34))
          .child(div().text_size(10).text_color(t.dim).child(LOOK_NAME[look])))))
      .child(label("衣服（顏色看是哪家 AI）"))
      .child(h_flex().gap(6)
        .children(OUTFITS.map((o) => v_flex().id(`outfit-${o}`).w(80).h(84).items_center().justify_center().gap(2).rounded(8).cursor_pointer()
          .border_1().border_color(this.outfit === o ? t.accent : t.input).bg(this.outfit === o ? t.selected : t.raised)
          .hover((s) => s.opacity(0.88)).on_click((_e, cx) => { this.outfit = o; cx.notify(); })
          .child(image(`${ART}body-${o}-stand-${color}.png`).w(30).h(60))
          .child(div().text_size(10).text_color(t.dim).child(OUTFIT_NAME[o])))))
      .child(label("坐在哪一區"))
      .child(h_flex().gap(8).flex_wrap()
        .children(spaces().filter((s) => !s.machine).map((s) => choice(`zone-${s.id}`, this.space === s.id, s.name, () => { this.space = s.id; }))))
      .child(h_flex().pt(20).gap(8).justify_end()
        .child(button("hire-cancel", "取消", false, () => closeOverlay(p.overlay)))
        .child(button("hire-ok", "請他上工", true, () => this.submit())));
  }
}
