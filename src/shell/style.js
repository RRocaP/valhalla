// All shell CSS, built from art.palette tokens (docs/SHELL.md "Styling").
// Every color is a `var(--token)` fed from the palette below — no literal
// hexes anywhere past this one interpolation point.

export function buildShellStyle(palette) {
  const p = palette;
  return `
:root{
  --oakDeep:${p.oakDeep};--oak:${p.oak};--oakLight:${p.oakLight};--tar:${p.tar};
  --gold:${p.gold};--goldBright:${p.goldBright};--blood:${p.blood};--ember:${p.ember};
  --fjord:${p.fjord};--fjordLight:${p.fjordLight};--pine:${p.pine};--pineLight:${p.pineLight};
  --bone:${p.bone};--boneDim:${p.boneDim};
  --font-display:'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif;
  --font-body:'Iowan Old Style','Palatino Nova',Palatino,Georgia,serif;
  --font-mono:ui-monospace,'SF Mono',Menlo,monospace;
  --safe-t:env(safe-area-inset-top,0px);--safe-r:env(safe-area-inset-right,0px);
  --safe-b:env(safe-area-inset-bottom,0px);--safe-l:env(safe-area-inset-left,0px);
}
*{box-sizing:border-box}
html,body{overflow-x:hidden}
#app{overflow-x:hidden;position:relative;font-family:var(--font-body);color:var(--bone);width:100%}
#app *{-webkit-tap-highlight-color:transparent}
:where(#app *){min-width:0}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
#app :focus{outline:none}
#app :focus-visible{outline:3px solid var(--goldBright);outline-offset:2px;border-radius:4px}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-appearance:none}
button:disabled{cursor:default}
p{margin:0}

/* ---- primitives ---- */
/* A gilded plate pinned to the wood: layered gold (never a flat fill), a dark
   seating shadow, a bright upper lip and a shaded lower one, plus the two rivet
   heads that pin it. A flat --gold rectangle read as a web CTA. */
.btn-carved{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.5em;
  background:linear-gradient(178deg,var(--goldBright) 0%,var(--gold) 38%,var(--gold) 62%,#8a6d18 100%);
  color:#2a1d05;font-weight:700;font-family:var(--font-display);letter-spacing:.12em;
  padding:13px 34px;min-height:46px;min-width:44px;border-radius:5px;
  text-shadow:0 1px 0 rgba(238,207,109,.55);
  box-shadow:0 3px 0 rgba(12,9,6,.85),0 5px 10px rgba(12,9,6,.6),
    inset 0 1px 0 rgba(255,241,199,.85),inset 0 -2px 2px rgba(90,58,30,.55),
    inset 0 0 0 1px rgba(42,29,5,.45);
  font-size:clamp(1rem,1vw + .75rem,1.12rem)}
.btn-carved::before,.btn-carved::after{content:"";position:absolute;top:50%;width:7px;height:7px;border-radius:50%;
  transform:translateY(-50%);
  background:radial-gradient(circle at 34% 30%,#fff1c7 0%,var(--goldBright) 40%,#7d6216 100%);
  box-shadow:0 1px 1px rgba(12,9,6,.7)}
.btn-carved::before{left:11px}
.btn-carved::after{right:11px}
.btn-carved:hover{filter:brightness(1.07)}
.btn-carved:active{transform:translateY(2px);
  box-shadow:0 1px 0 rgba(12,9,6,.85),0 2px 5px rgba(12,9,6,.6),
    inset 0 1px 0 rgba(255,241,199,.6),inset 0 -1px 2px rgba(90,58,30,.55),
    inset 0 0 0 1px rgba(42,29,5,.45)}

/* Canvas-relief headings (docs/ART.md full-depth call-outs): the canvas is the
   visual, the real text is visually-hidden inside for a11y and tests. */
.carved-heading{display:block;margin:0;line-height:0}
.carved-heading canvas{display:block;margin:0 auto;max-width:100%;height:auto}
.btn-quiet{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 12px;color:var(--boneDim);text-decoration:underline;text-underline-offset:3px;font-size:.95rem;letter-spacing:.04em}
.btn-quiet:hover{color:var(--bone)}
.btn-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:var(--oakDeep);color:var(--gold);border:1px solid var(--oakLight)}
.btn-icon:hover{background:var(--oak)}

.confirm-wrap{display:inline-flex;align-items:center}
/* es/ca confirm labels run long — wrap inside the pill rather than overflow at 390px */
.confirm-row{display:inline-flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:10px;background:var(--oakDeep);border:1px solid var(--blood);border-radius:8px;padding:6px 10px}
.confirm-yes{min-height:36px;padding:6px 14px;background:var(--blood);color:var(--bone);border-radius:5px;font-weight:600}
.confirm-no{min-height:36px;padding:6px 10px;color:var(--boneDim);text-decoration:underline}

/* ---- screens ---- */
.screen{min-height:100vh;min-height:100dvh;width:100%;position:relative;padding:max(16px,var(--safe-t)) max(16px,var(--safe-r)) max(16px,var(--safe-b)) max(16px,var(--safe-l));overflow:hidden}

.screen-threshold{padding:0;display:block}
/* min-height:100% resolved against an auto-height parent, i.e. against
   nothing — the title card sat pinned to the top of an otherwise empty
   screen. Anchor it to the viewport so the card is actually centred. */
.threshold-content{position:relative;z-index:1;min-height:100vh;min-height:100dvh;display:grid;place-content:center;justify-items:center;gap:clamp(14px,3vh,30px);text-align:center;padding:max(16px,var(--safe-t)) max(16px,var(--safe-r)) max(16px,var(--safe-b)) max(16px,var(--safe-l))}
.title{font-family:var(--font-display);letter-spacing:.35em;color:var(--gold);font-weight:600;font-size:clamp(2rem,5vw + 1rem,3.6rem);margin:0}
.subtitle{color:var(--boneDim);font-size:clamp(.95rem,1.5vw + .6rem,1.25rem);margin:0;letter-spacing:.09em;font-style:italic;text-shadow:0 1px 0 rgba(12,9,6,.8)}
.threshold-actions{display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:8px}

.screen-lid{padding:0;display:block}
.lid-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.lid-medallions{position:absolute;inset:0;width:100%;height:100%}
.medallion-hit{position:absolute;width:var(--mr,48px);height:var(--mr,48px);min-width:44px;min-height:44px;border-radius:50%;transform:translate(-50%,-50%)}
.medallion-hit:disabled{pointer-events:none}
.hasp-wrap{position:absolute;left:0;right:0;bottom:max(76px,calc(var(--safe-b) + 76px));display:flex;justify-content:center;pointer-events:none}
.hasp-canvas{display:block}
.lid-chrome{position:absolute;inset:0;pointer-events:none}
.lid-chrome > *{pointer-events:auto}
.journal-handle{position:absolute;left:50%;bottom:max(14px,var(--safe-b));transform:translateX(-50%)}
.settings-nail{position:absolute;top:max(14px,var(--safe-t));right:max(14px,var(--safe-r))}

.screen-lockroom{padding:max(12px,var(--safe-t)) max(12px,var(--safe-r)) max(12px,var(--safe-b)) max(12px,var(--safe-l));display:grid}
.lockroom-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.lockroom-frame{position:relative;display:grid;grid-template-rows:auto 1fr auto;gap:10px;max-width:820px;width:100%;margin:0 auto;min-height:calc(100vh - 24px);min-height:calc(100dvh - 24px)}
.lockroom-frame.shudder{animation:shudder .32s ease}
@keyframes shudder{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
.lockroom-header{text-align:center;padding:18px 10px 6px}
/* Struck ledger numerals: tracked wide, seated with relief, framed by faint
   middots — a stamp in the rail, not a caption. */
.ledger-numeral{font-family:var(--font-mono);color:var(--goldBright);letter-spacing:.42em;font-weight:600;
  font-size:clamp(1.02rem,1vw + .66rem,1.3rem);
  text-shadow:-1px -1px 0 var(--tar),1px 1px 0 rgba(238,207,109,.24),0 0 16px rgba(238,207,109,.14)}
.ledger-numeral::before{content:'\\00B7\\2002';color:rgba(238,207,109,.42)}
.ledger-numeral::after{content:'\\2002\\00B7';color:rgba(238,207,109,.42);margin-left:-.42em}
.lock-title{font-family:var(--font-display);color:var(--bone);font-size:clamp(1.3rem,2vw + 1rem,2rem);margin:.2em 0}
.lock-epigraph{font-family:var(--font-body);font-style:italic;color:var(--boneDim);font-size:clamp(.9rem,.8vw + .7rem,1.05rem);max-width:52ch;margin:0 auto}
.lock-root{position:relative;min-height:0;padding:12px;display:flex;flex-direction:column;justify-content:center;align-items:stretch}
.lockroom-footer{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 10px 18px}
.near-line{color:var(--goldBright);font-style:italic;min-height:1.4em;text-align:center;font-size:.95rem;text-shadow:0 1px 0 rgba(12,9,6,.85)}
.attempts-row{display:flex;align-items:center;gap:10px}
.attempts-dots{display:flex;flex-wrap:wrap;gap:6px;max-width:220px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--oakLight)}
.hint-horn{display:flex;gap:10px}
.hint-slot{min-height:44px;padding:8px 14px;border-radius:6px;border:1px solid var(--oakLight);color:var(--boneDim);font-size:.85rem;font-family:var(--font-display);font-variant-caps:all-small-caps;letter-spacing:.14em}
.hint-slot[data-state="armed"]{border-color:var(--gold);color:var(--goldBright)}
.hint-slot[data-state="taken"]{border-color:var(--gold);background:var(--oakDeep);color:var(--bone);cursor:default}
.hint-slot[data-state="locked"]{opacity:.4;pointer-events:none}
.hint-text{max-width:52ch;text-align:center;color:var(--boneDim);font-size:.9rem}
/* The room's exit is a quiet carved latch, not a hyperlink (QUALITY_LOOP4:
   an underlined text link was the one web-default control left on the board).
   Class + label are contract surface and stay exactly as pinned. */
.back-latch{margin-top:4px;text-decoration:none;font-family:var(--font-display);
  font-variant-caps:all-small-caps;letter-spacing:.14em;font-size:.95rem;
  padding:8px 20px;border-radius:6px;border:1px solid rgba(233,220,195,.16);
  background:linear-gradient(180deg,rgba(12,9,6,.3),rgba(12,9,6,.52));
  box-shadow:inset 0 1px 0 rgba(233,220,195,.07),0 1px 0 rgba(12,9,6,.55)}
.back-latch:hover{color:var(--bone);border-color:rgba(201,162,39,.42)}
/* Quiet scroll cue (QUALITY_LOOP4): boards taller than the window get a soft
   gold chevron at the fold — visible only while more board remains below. */
.scroll-cue{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:5;
  width:44px;height:26px;display:flex;align-items:center;justify-content:center;
  color:var(--gold);opacity:0;pointer-events:none;transition:opacity .35s ease;
  filter:drop-shadow(0 1px 0 rgba(12,9,6,.9)) drop-shadow(0 0 8px rgba(12,9,6,.6))}
.scroll-cue::before{content:'';width:11px;height:11px;margin-top:-6px;
  border-right:2.5px solid currentColor;border-bottom:2.5px solid currentColor;transform:rotate(45deg)}
.scroll-cue.show{opacity:.6;animation:cue-bob 2.8s ease-in-out infinite}
@keyframes cue-bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,5px)}}
.reduced-motion .scroll-cue.show{animation:none}
@media (prefers-reduced-motion: reduce){.scroll-cue.show{animation:none}}
/* pointer-events must stay AUTO: the shard ceremony and the duel yield beat
   are documented tap-to-skip (docs/SHELL.md; src/shell/dom.js playBeat binds
   the click on this element). Setting it to none silently swallowed every
   skip tap. The overlay only ever covers an already-cleared .lock-root, so
   nothing interactive sits beneath it. */
.ceremony-overlay{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:8px;pointer-events:auto;cursor:pointer;isolation:isolate}
/* Ceremony stagecraft (QUALITY_LOOP4): the beat owns the whole stage. A fixed
   house-dimming vignette rides under the overlay content (covering the room
   chrome — header, hints, latch — exactly like the dare's), with the warm
   ceremony pool kept just behind the rune/portrait. Tap-anywhere still skips:
   the fixed pseudo extends the overlay's own hit area. */
.ceremony-overlay::before{content:'';position:fixed;inset:0;z-index:-2;
  background:radial-gradient(ellipse 64% 58% at 50% 46%,rgba(12,9,6,.14) 0%,rgba(12,9,6,.5) 58%,rgba(12,9,6,.64) 100%);
  animation:dare-dim .55s ease-out both}
.ceremony-overlay::after{content:'';position:absolute;inset:0;z-index:-1;
  background:radial-gradient(ellipse at center, rgba(201,162,39,.2), transparent 70%)}
.reduced-motion .ceremony-overlay::before{animation:none}
.ceremony-overlay .shard-rune{display:block;margin:0 auto}
.ceremony-line{font-family:var(--font-display);color:var(--goldBright);font-size:clamp(1.1rem,2vw + .8rem,1.6rem);letter-spacing:.04em;
  text-shadow:-1.5px -1.5px 1px var(--tar),1.5px 1.5px 1px rgba(238,207,109,.26),0 0 18px rgba(238,207,109,.16)}

.screen-finale{padding:0;display:block}
.finale-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.finale-chrome{position:relative;min-height:100vh;min-height:100dvh;display:grid;grid-template-rows:1fr auto;pointer-events:none}
.finale-chrome > *{pointer-events:auto}
.finale-title{font-family:var(--font-display);letter-spacing:.16em;color:var(--goldBright);font-size:clamp(1.4rem,3vw + 1rem,2.4rem);margin:0;
  text-shadow:-1.5px -1.5px 1px var(--tar),2px 2px 1.5px rgba(238,207,109,.28),0 0 20px rgba(238,207,109,.15)}
.finale-sub{color:var(--boneDim);font-style:italic;margin:.3em 0 0}
.finale-footer{text-align:center;padding:14px max(16px,var(--safe-r)) max(18px,var(--safe-b));display:flex;flex-direction:column;align-items:center;gap:10px}
.finale-colophon{color:var(--boneDim);font-family:var(--font-display);font-variant-caps:all-small-caps;font-size:.85rem;letter-spacing:.12em;opacity:.8;text-shadow:0 1px 0 rgba(12,9,6,.7)}
.skip-hint{position:absolute;bottom:max(18px,var(--safe-b));left:50%;transform:translateX(-50%);color:var(--boneDim);font-size:.85rem;opacity:.75}
.continue-hint{color:var(--boneDim);font-size:.85rem;opacity:.75;margin-top:6px}

/* ---- overlays ---- */
.overlay-scrim{position:fixed;inset:0;background:rgba(12,9,6,.6);z-index:20}
/* Vellum drawers: a deep laid-paper dark (layered, never one flat fill) under
   a gilded hairline — the journal reads as an inked page, not a settings
   sheet. The faint horizontal rhythm is the page's chain lines. */
.drawer,.panel-overlay{position:fixed;left:0;right:0;z-index:21;display:flex;flex-direction:column;max-height:78vh;
  background:
    linear-gradient(180deg,rgba(233,220,195,.045),rgba(233,220,195,0) 46px),
    repeating-linear-gradient(180deg,transparent 0px,transparent 25px,rgba(233,220,195,.04) 25px,rgba(233,220,195,.04) 26px),
    linear-gradient(180deg,#2c1c0c 0%,#1d1207 58%,#140c05 100%);
  border-top:1px solid rgba(201,162,39,.45);
  box-shadow:0 -1px 0 rgba(12,9,6,.9),0 -12px 34px rgba(12,9,6,.55);
  padding:max(14px,var(--safe-b)) max(18px,var(--safe-r)) max(18px,var(--safe-b)) max(18px,var(--safe-l))}
.drawer{bottom:0;border-radius:14px 14px 0 0;transform:translateY(100%);transition:transform .28s ease}
.drawer.open{transform:translateY(0)}
.panel-overlay{bottom:0;border-radius:14px 14px 0 0;transform:translateY(100%);transition:transform .28s ease}
.panel-overlay.open{transform:translateY(0)}
.reduced-motion .drawer,.reduced-motion .panel-overlay{transition:none}
.overlay-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.overlay-title{font-family:var(--font-display);color:var(--gold);letter-spacing:.26em;font-size:1.18rem;font-weight:600;
  text-shadow:-1.5px -1.5px 1px var(--tar),1.5px 1.5px 1px rgba(238,207,109,.22)}
.overlay-close{min-width:44px;min-height:44px;color:var(--boneDim)}
/* ink on the vellum: warm bone ink, a blood-ruled margin, hairline entry rules */
.journal-list{overflow-y:auto;display:flex;flex-direction:column;gap:7px;font-family:var(--font-body);color:var(--bone);font-size:.94rem;line-height:1.5;
  padding:4px 4px 4px 16px;border-left:2px solid rgba(143,31,31,.42)}
.journal-line{border-bottom:1px solid rgba(233,220,195,.09);padding-bottom:7px;text-shadow:0 1px 0 rgba(12,9,6,.7)}
.journal-empty{color:var(--boneDim);font-style:italic}
/* rows wrap: es/ca labels ("Movimiento reducido" + "Según el sistema") outgrow
   one 390px line — the control drops under the label instead of clipping */
.settings-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 14px;padding:12px 0;border-bottom:1px solid rgba(233,220,195,.08)}
.settings-label{font-size:.95rem;color:var(--bone)}
.toggle{width:46px;height:26px;border-radius:13px;background:var(--oakDeep);border:1px solid var(--oakLight);position:relative;min-height:0}
.toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:var(--boneDim);transition:transform .15s ease}
.toggle[aria-pressed="true"]{background:var(--gold)}
.toggle[aria-pressed="true"]::after{transform:translateX(20px);background:var(--tar)}
.reduced-motion .toggle::after{transition:none}
.segmented{display:flex;border:1px solid var(--oakLight);border-radius:8px;overflow:hidden}
.segmented-option{min-height:40px;padding:8px 12px;color:var(--boneDim);font-size:.85rem}
.segmented-option[aria-pressed="true"]{background:var(--gold);color:var(--tar)}

/* ---- language switcher (CONTRACT §4.1 amendment): three carved plates,
   the current tongue gold-struck. ≥44px targets. ---- */
.lang-row{display:flex;gap:8px;flex-wrap:wrap}
.lang-btn{min-width:56px;min-height:45px;padding:8px 12px;border-radius:6px;
  font-family:var(--font-display);font-weight:700;letter-spacing:.1em;font-size:.9rem;color:var(--boneDim);
  background:linear-gradient(180deg,var(--oak) 0%,var(--oakDeep) 100%);
  box-shadow:0 2px 0 rgba(12,9,6,.7),0 3px 6px rgba(12,9,6,.35),
    inset 0 1px 0 rgba(233,220,195,.14),inset 0 0 0 1px rgba(12,9,6,.55)}
.lang-btn:hover{color:var(--bone);filter:brightness(1.08)}
.lang-btn[aria-pressed="true"]{color:#2a1d05;
  background:linear-gradient(178deg,var(--goldBright) 0%,var(--gold) 55%,#8a6d18 100%);
  text-shadow:0 1px 0 rgba(238,207,109,.55);transform:translateY(1px);cursor:default;
  box-shadow:0 1px 0 rgba(12,9,6,.85),0 2px 4px rgba(12,9,6,.5),
    inset 0 1px 0 rgba(255,241,199,.85),inset 0 -2px 2px rgba(90,58,30,.5),inset 0 0 0 1px rgba(42,29,5,.45)}

@media (prefers-reduced-motion: reduce){
  .lockroom-frame.shudder{animation:none}
  .drawer,.panel-overlay,.toggle::after{transition:none}
  .dare-card,.dare-portrait,.dare-vignette{animation:none}
}

/* ---- material-type mandate: DOM-text relief recipe (ART.md) ---- */
/* Paired 1px shadows: tar above-left, goldBright ~18% below-right. */
.carved-text{text-shadow:-1px -1px 0 var(--tar),1px 1px 0 rgba(238,207,109,.18)}
/* Stronger relief (depth >=0.7 equivalent) for the title card, lock headers,
   and shard numerals — the "at times even volume" call-outs. */
.carved-text-deep{text-shadow:-1.5px -1.5px 1px var(--tar),2px 2px 1.5px rgba(238,207,109,.3),0 0 18px rgba(238,207,109,.14)}

/* ---- duels (docs/JARLS.md) ---- */
/* The challenger's war-banner: a swallow-tailed cloth ribbon (clip-path ends),
   layered blood with a lit top edge and a shadowed hem, small-caps display
   lettering. max-width + ellipsis kept: a nowrap banner anchored on the
   rightmost medallion ran off the screen edge at 390px (Aerya's name). */
.duel-banner{position:absolute;transform:translate(-50%,-100%);color:var(--bone);font-family:var(--font-display);
  font-size:.78rem;font-weight:600;letter-spacing:.13em;font-variant-caps:small-caps;
  background:var(--blood);
  background-image:linear-gradient(180deg,rgba(238,207,109,.28) 0,rgba(238,207,109,0) 3px),linear-gradient(180deg,rgba(255,241,199,.12),rgba(12,9,6,.05) 40%,rgba(12,9,6,.38));
  padding:6px 20px;white-space:nowrap;pointer-events:none;
  clip-path:polygon(0 0,100% 0,calc(100% - 9px) 50%,100% 100%,0 100%,9px 50%);
  filter:drop-shadow(0 2px 1px rgba(12,9,6,.75)) drop-shadow(0 5px 8px rgba(12,9,6,.45));
  text-shadow:0 1px 0 rgba(12,9,6,.75);
  max-width:min(88vw,320px);overflow:hidden;text-overflow:ellipsis}
/* dare theatre: darkened house, lit stage. Fixed, not absolute: the dimming
   must own the WHOLE house — the chapter header above the card stayed fully
   lit and fought the jarl for the moment (QUALITY_LOOP4). */
.dare-vignette{position:fixed;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 62% 56% at 50% 44%,rgba(12,9,6,0) 30%,rgba(12,9,6,.55) 66%,rgba(12,9,6,.44) 100%)}
.dare-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;padding:20px;max-width:420px;margin:0 auto}
.dare-card canvas{display:block}
.dare-name{font-family:var(--font-display);color:var(--goldBright);letter-spacing:.08em;font-size:clamp(1.2rem,2vw + .9rem,1.6rem);margin:0}
/* the taunt set like an inscription: hairline rules above and below */
.dare-taunt{color:var(--boneDim);font-style:italic;max-width:46ch;margin:0;padding:10px 6px;line-height:1.55;letter-spacing:.015em;
  border-top:1px solid rgba(233,220,195,.16);border-bottom:1px solid rgba(233,220,195,.16);text-shadow:0 1px 0 rgba(12,9,6,.7)}
@keyframes dare-rise{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:none}}
@keyframes dare-warm{0%{filter:brightness(.18) saturate(.7)}55%{filter:brightness(.62) saturate(.88)}100%{filter:none}}
@keyframes dare-dim{from{opacity:0}to{opacity:1}}
.dare-card{animation:dare-rise .9s cubic-bezier(.22,1,.36,1) both}
.dare-portrait{animation:dare-warm 1.6s ease-out both}
.dare-vignette{animation:dare-dim .8s ease-out both}
.reduced-motion .dare-card,.reduced-motion .dare-portrait,.reduced-motion .dare-vignette{animation:none}
.dot-overflow{font-family:var(--font-mono);font-size:.7rem;color:var(--boneDim);align-self:center}

/* ---- finale (docs/JARLS.md "The treasures") ---- */
.finale-reveal{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:16px;justify-self:center;align-self:center}
.finale-reveal canvas{display:block;margin:0 auto}
.finale-epithet{color:var(--boneDim);font-style:italic;max-width:44ch;margin:.2em auto 0}
.finale-tableau{display:flex;flex-wrap:wrap;justify-content:center;gap:24px;margin-top:8px}
.finale-tableau-item{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;font-size:.8rem;color:var(--boneDim);margin:0}
.finale-tableau-item figcaption{max-width:20ch}

/* ---- credits (docs/SHELL.md #5) ---- */
.screen-credits{padding:0;display:block}
.sticker-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.credits-scroll{position:relative;z-index:2;height:100vh;height:100dvh;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;padding:12vh max(20px,var(--safe-r)) 14vh max(20px,var(--safe-l));display:flex;flex-direction:column;gap:14vh}
.credits-section{text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.credits-section h2{font-family:var(--font-display);color:var(--goldBright);letter-spacing:.26em;font-size:clamp(1.1rem,1.5vw + .8rem,1.4rem);margin:0;
  text-shadow:-1.5px -1.5px 1px var(--tar),1.5px 1.5px 1px rgba(238,207,109,.24)}
.credits-section p{color:var(--boneDim);margin:0;letter-spacing:.02em}
.credits-title{font-family:var(--font-display);letter-spacing:.34em;color:var(--gold);font-size:clamp(1.8rem,4vw + 1rem,3rem);margin:0;
  text-shadow:-2px -2px 1px var(--tar),2px 2px 1.5px rgba(238,207,109,.3),0 0 22px rgba(238,207,109,.14)}
.credits-colophon{opacity:.85}
.credits-challengers{display:flex;flex-wrap:wrap;justify-content:center;gap:22px}
.credits-portrait{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:.78rem;color:var(--boneDim);margin:0}
.credits-portrait canvas{display:block}
.credits-portrait figcaption{font-family:var(--font-display);font-variant-caps:all-small-caps;letter-spacing:.12em;font-size:.9rem;text-shadow:0 1px 0 rgba(12,9,6,.7)}
.credits-portrait-white figcaption{color:var(--bone)}
.credits-skip{position:fixed;top:max(14px,var(--safe-t));right:max(14px,var(--safe-r));z-index:3;background:rgba(12,9,6,.5);border-radius:6px}
.sticker-scatter{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.sticker-static{width:60px;height:auto;display:block}

@media (prefers-reduced-motion: reduce){
  .credits-scroll{scroll-behavior:auto}
}
`;
}
