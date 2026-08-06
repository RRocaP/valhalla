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
#app *{-webkit-tap-highlight-color:transparent;min-width:0}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
#app :focus{outline:none}
#app :focus-visible{outline:3px solid var(--goldBright);outline-offset:2px;border-radius:4px}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;-webkit-appearance:none}
button:disabled{cursor:default}
p{margin:0}

/* ---- primitives ---- */
.btn-carved{display:inline-flex;align-items:center;justify-content:center;gap:.5em;background:var(--gold);color:var(--tar);font-weight:600;font-family:var(--font-display);letter-spacing:.04em;padding:12px 26px;min-height:44px;min-width:44px;border-radius:7px;box-shadow:0 2px 0 var(--oakDeep),inset 0 1px 0 var(--goldBright);font-size:clamp(1rem,1vw + .75rem,1.15rem)}
.btn-carved:hover{filter:brightness(1.08)}
.btn-carved:active{transform:translateY(1px);box-shadow:0 1px 0 var(--oakDeep),inset 0 1px 0 var(--goldBright)}
.btn-quiet{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:8px 12px;color:var(--boneDim);text-decoration:underline;text-underline-offset:3px;font-size:.95rem}
.btn-quiet:hover{color:var(--bone)}
.btn-icon{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:var(--oakDeep);color:var(--gold);border:1px solid var(--oakLight)}
.btn-icon:hover{background:var(--oak)}

.confirm-wrap{display:inline-flex;align-items:center}
.confirm-row{display:inline-flex;align-items:center;gap:10px;background:var(--oakDeep);border:1px solid var(--blood);border-radius:8px;padding:6px 10px}
.confirm-yes{min-height:36px;padding:6px 14px;background:var(--blood);color:var(--bone);border-radius:5px;font-weight:600}
.confirm-no{min-height:36px;padding:6px 10px;color:var(--boneDim);text-decoration:underline}

/* ---- screens ---- */
.screen{min-height:100vh;min-height:100dvh;width:100%;position:relative;padding:max(16px,var(--safe-t)) max(16px,var(--safe-r)) max(16px,var(--safe-b)) max(16px,var(--safe-l));overflow:hidden}

.screen-threshold{display:grid;place-content:center;justify-items:center;gap:clamp(14px,3vh,30px);text-align:center;background:var(--oakDeep)}
.title{font-family:var(--font-display);letter-spacing:.35em;color:var(--gold);font-weight:600;font-size:clamp(2rem,5vw + 1rem,3.6rem);margin:0}
.subtitle{color:var(--boneDim);font-size:clamp(.95rem,1.5vw + .6rem,1.25rem);margin:0;letter-spacing:.03em;font-style:italic}
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
.ledger-numeral{font-family:var(--font-mono);color:var(--goldBright);letter-spacing:.15em;font-size:clamp(.85rem,1vw + .5rem,1.05rem)}
.lock-title{font-family:var(--font-display);color:var(--bone);font-size:clamp(1.3rem,2vw + 1rem,2rem);margin:.2em 0}
.lock-epigraph{font-family:var(--font-body);font-style:italic;color:var(--boneDim);font-size:clamp(.9rem,.8vw + .7rem,1.05rem);max-width:52ch;margin:0 auto}
.lock-root{position:relative;min-height:0;padding:12px}
.lockroom-footer{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 10px 18px}
.near-line{color:var(--goldBright);font-style:italic;min-height:1.4em;text-align:center;font-size:.95rem}
.attempts-row{display:flex;align-items:center;gap:10px}
.attempts-dots{display:flex;flex-wrap:wrap;gap:6px;max-width:220px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--oakLight)}
.hint-horn{display:flex;gap:10px}
.hint-slot{min-height:44px;padding:8px 14px;border-radius:6px;border:1px solid var(--oakLight);color:var(--boneDim);font-size:.85rem}
.hint-slot[data-state="armed"]{border-color:var(--gold);color:var(--goldBright)}
.hint-slot[data-state="taken"]{border-color:var(--gold);background:var(--oakDeep);color:var(--bone);cursor:default}
.hint-slot[data-state="locked"]{opacity:.4;pointer-events:none}
.hint-text{max-width:52ch;text-align:center;color:var(--boneDim);font-size:.9rem}
.back-latch{margin-top:4px}
.ceremony-overlay{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:8px;background:radial-gradient(ellipse at center, rgba(201,162,39,.16), transparent 70%);pointer-events:none}
.ceremony-overlay .shard-rune{display:block;margin:0 auto}
.ceremony-line{font-family:var(--font-display);color:var(--goldBright);font-size:clamp(1.1rem,2vw + .8rem,1.6rem)}

.screen-finale{padding:0;display:block}
.finale-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.finale-chrome{position:relative;min-height:100vh;min-height:100dvh;display:grid;grid-template-rows:1fr auto;pointer-events:none}
.finale-chrome > *{pointer-events:auto}
.finale-titles{align-self:end;text-align:center;padding-bottom:6px}
.finale-title{font-family:var(--font-display);letter-spacing:.12em;color:var(--goldBright);font-size:clamp(1.4rem,3vw + 1rem,2.4rem);margin:0}
.finale-sub{color:var(--boneDim);font-style:italic;margin:.3em 0 0}
.finale-footer{text-align:center;padding:14px max(16px,var(--safe-r)) max(18px,var(--safe-b));display:flex;flex-direction:column;align-items:center;gap:10px}
.finale-colophon{color:var(--boneDim);font-family:var(--font-mono);font-size:.75rem;letter-spacing:.08em;opacity:.8}
.skip-hint{position:absolute;bottom:max(18px,var(--safe-b));left:50%;transform:translateX(-50%);color:var(--boneDim);font-size:.85rem;opacity:.75}

/* ---- overlays ---- */
.overlay-scrim{position:fixed;inset:0;background:rgba(12,9,6,.6);z-index:20}
.drawer,.panel-overlay{position:fixed;left:0;right:0;background:var(--oak);border-top:1px solid var(--oakLight);z-index:21;display:flex;flex-direction:column;max-height:78vh;padding:max(14px,var(--safe-b)) max(18px,var(--safe-r)) max(18px,var(--safe-b)) max(18px,var(--safe-l))}
.drawer{bottom:0;border-radius:14px 14px 0 0;transform:translateY(100%);transition:transform .28s ease}
.drawer.open{transform:translateY(0)}
.panel-overlay{bottom:0;border-radius:14px 14px 0 0;transform:translateY(100%);transition:transform .28s ease}
.panel-overlay.open{transform:translateY(0)}
.reduced-motion .drawer,.reduced-motion .panel-overlay{transition:none}
.overlay-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.overlay-title{font-family:var(--font-display);color:var(--gold);letter-spacing:.08em;font-size:1.1rem}
.overlay-close{min-width:44px;min-height:44px;color:var(--boneDim)}
.journal-list{overflow-y:auto;display:flex;flex-direction:column;gap:6px;font-family:var(--font-body);color:var(--boneDim);font-size:.92rem;padding-right:4px}
.journal-line{border-bottom:1px solid rgba(233,220,195,.08);padding-bottom:6px}
.journal-empty{color:var(--boneDim);font-style:italic}
.settings-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid rgba(233,220,195,.08)}
.settings-label{font-size:.95rem;color:var(--bone)}
.toggle{width:46px;height:26px;border-radius:13px;background:var(--oakDeep);border:1px solid var(--oakLight);position:relative;min-height:0}
.toggle::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:var(--boneDim);transition:transform .15s ease}
.toggle[aria-pressed="true"]{background:var(--gold)}
.toggle[aria-pressed="true"]::after{transform:translateX(20px);background:var(--tar)}
.reduced-motion .toggle::after{transition:none}
.segmented{display:flex;border:1px solid var(--oakLight);border-radius:8px;overflow:hidden}
.segmented-option{min-height:40px;padding:8px 12px;color:var(--boneDim);font-size:.85rem}
.segmented-option[aria-pressed="true"]{background:var(--gold);color:var(--tar)}

@media (prefers-reduced-motion: reduce){
  .lockroom-frame.shudder{animation:none}
  .drawer,.panel-overlay,.toggle::after{transition:none}
}
`;
}
