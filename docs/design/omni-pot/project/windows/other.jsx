/* global React, TitlebarLeft, Switch, Select, LangSelect, Flag, SvcTile, Icons */
const { useState: useStateR } = React;

const OCR_ENGINES = [
  { value:'system', label: '系统识别', mono:'system' },
  { value:'tesseract', label: 'Tesseract', mono:'tesseract' },
  { value:'openai_compatible', label: 'AI 视觉 · Qwen2.5-VL', mono:'openai_compatible' },
  { value:'baidu_accurate_ocr', label: '百度高精度', mono:'baidu_accurate_ocr' },
];
const OCR_LANGS = [
  { value:'auto', label:'自动检测' },
  { value:'en', label:'English' },
  { value:'zh_cn', label:'简体中文' },
  { value:'zh_tw', label:'繁體中文' },
  { value:'ja', label:'日本語' },
  { value:'ko', label:'한국어' },
  { value:'fr', label:'Français' },
  { value:'de', label:'Deutsch' },
  { value:'es', label:'Español' },
  { value:'ru', label:'Русский' },
];
const EXPORT_FORMATS = [
  { value:'md',   label:'Markdown',     ext:'.md' },
  { value:'txt',  label:'纯文本',        ext:'.txt' },
  { value:'docx', label:'Word 文档',     ext:'.docx' },
  { value:'doc',  label:'Word 97-2003',  ext:'.doc' },
];

// Compact pill-style select used in the OCR action bar.
// Popup is portaled to body and opens UP (the action bar sits at the window
// bottom) so it isn't clipped by the artboard / canvas transform.
const PillSelect = ({ value, options, leading, style, onChange }) => {
  const [open, setOpen] = useStateR(false);
  const [coords, setCoords] = useStateR({ left: 0, top: 0, maxH: 280 });
  const triggerRef = React.useRef(null);
  const popRef = React.useRef(null);
  const POP_W = 220;

  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popH = Math.min(280, options.length * 32 + 8);
    const spaceAbove = r.top;
    const above = spaceAbove > popH + 12; // action bar is at the bottom — prefer up
    setCoords({
      left: Math.min(Math.max(8, r.left), window.innerWidth - POP_W - 8),
      top: above ? r.top - popH - 6 : r.bottom + 6,
      maxH: popH,
    });
  };

  React.useEffect(() => {
    if (!open) return;
    measure();
    const onS = () => measure();
    const onD = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onS, true);
    window.addEventListener('resize', onS);
    document.addEventListener('mousedown', onD);
    return () => {
      window.removeEventListener('scroll', onS, true);
      window.removeEventListener('resize', onS);
      document.removeEventListener('mousedown', onD);
    };
  }, [open]);

  const cur = options.find(o => o.value === value);
  const pop = open && ReactDOM.createPortal(
    <div ref={popRef} style={{
      position:'fixed', left: coords.left, top: coords.top,
      width: POP_W, maxHeight: coords.maxH, overflowY:'auto',
      background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius: 8,
      boxShadow:'0 10px 28px rgba(0,0,0,0.14)', padding: 4, zIndex: 10000,
    }}>
      {options.map(o => (
        <div key={o.value}
          onClick={(e) => { e.stopPropagation(); onChange && onChange(o.value); setOpen(false); }}
          style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 12.5, cursor:'pointer',
            display:'flex', alignItems:'center', gap: 6, whiteSpace:'nowrap',
            background: o.value === value ? 'var(--brand-primary-soft)' : 'transparent',
            color: o.value === value ? 'var(--brand-primary)' : 'var(--text)',
          }}>
          {o.mono && <SvcTile name={o.mono} />}
          <span>{o.label}</span>
          {o.ext && <span className="hint mono" style={{ marginLeft:'auto' }}>{o.ext}</span>}
        </div>
      ))}
    </div>,
    document.body
  );

  return (
    <div style={{ position:'relative', ...style }}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        style={{
          height: 30, padding: '0 10px', borderRadius: 8,
          background: open ? 'var(--bg-elev)' : 'var(--bg-card)', border: '1px solid var(--line-soft)',
          color: 'var(--text)', fontSize: 12.5, fontWeight: 500,
          display: 'inline-flex', alignItems:'center', gap: 6, cursor:'pointer',
        }}>
        {leading}
        <span>{cur?.label || value}</span>
        <Icons.Chev size={11} style={{ color:'var(--text-mute)' }}/>
      </button>
      {pop}
    </div>
  );
};

// Pill-style button with text — same dimensions as PillSelect, no chevron
const PillButton = ({ icon, label, onClick }) => (
  <button onClick={onClick}
    style={{
      height: 30, padding: '0 10px', borderRadius: 8,
      background: 'var(--bg-card)', border: '1px solid var(--line-soft)',
      color: 'var(--text)', fontSize: 12.5, fontWeight: 500,
      display: 'inline-flex', alignItems:'center', gap: 6, cursor:'pointer',
    }}>
    {icon}
    <span>{label}</span>
  </button>
);

const ExportButton = () => {
  const [open, setOpen] = useStateR(false);
  return (
    <div style={{ position:'relative' }}>
      <button className="ic-btn" title="导出" onClick={() => setOpen(o => !o)}>
        <Icons.Export size={16}/>
      </button>
      {open && (
        <div style={{ position:'absolute', bottom:'calc(100% + 6px)', right: 0, minWidth: 200, background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius: 8, boxShadow:'0 8px 24px rgba(0,0,0,0.08)', padding: 4, zIndex: 50 }}>
          <div style={{ padding:'6px 10px', fontFamily:'var(--font-mono)', fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'.06em' }}>导出格式</div>
          {EXPORT_FORMATS.map(f => (
            <div key={f.value} onClick={()=>setOpen(false)}
              style={{ padding:'6px 10px', borderRadius: 6, cursor:'pointer', fontSize:12.5, display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-sunk)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span style={{ flex:1 }}>{f.label}</span>
              <span className="hint mono">{f.ext}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RecognizeWindow = ({ translate = false }) => {
  const [tgt, setTgt] = useStateR('zh_cn');
  return (
    <div className="op-window" style={{ width: '100%', height: '100%' }}>
      {/* Row 1 — titlebar */}
      <TitlebarLeft mode={translate ? '截图翻译' : '文字识别'} pinned={true} />

      {/* Row 2 — image | text(s) */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0, gap: 10, padding: '4px 10px 8px' }}>
        {/* Image card */}
        <div className="card" style={{ padding: 6, display:'flex', flexDirection:'column', minHeight: 0 }}>
          <div style={{ flex:1, borderRadius: 7, background:'#f7f5f0', border:'1px solid var(--line-soft)', overflow:'hidden', position:'relative' }}>
            <div style={{ position:'absolute', inset: 0, padding: 18, display:'flex', flexDirection:'column', justifyContent:'center', gap: 8, fontFamily:'var(--font-sans)' }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'oklch(20% 0.01 60)' }}>Reconciling Distributed State</div>
              <div style={{ fontSize: 13, color: 'oklch(40% 0.01 60)', lineHeight: 1.55 }}>
                When two replicas diverge after a partition, the merge function must be
                associative and commutative — otherwise the order of arriving operations
                matters and the result is no longer a CRDT.
              </div>
              <div style={{ fontSize: 11, color:'oklch(55% 0.01 60)', marginTop: 4, fontFamily:'var(--font-mono)' }}>fig 3.2 — eventual consistency</div>
            </div>
          </div>
        </div>

        {/* Text card(s) — translate state is just a transition from recognize,
           so the two cards share visual language. No special bg / no special
           label color — the only differentiator is a small mono label. */}
        {translate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
            <div className="card" style={{ padding: '12px 14px', flex: 1, overflow:'auto', minHeight: 0 }}>
              <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom: 6 }}>识别 · English</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.65, color:'var(--text)', whiteSpace:'pre-wrap' }}>
                {`Reconciling Distributed State

When two replicas diverge after a partition, the merge function must be associative and commutative — otherwise the order of arriving operations matters and the result is no longer a CRDT.`}
              </div>
            </div>
            <div className="card" style={{ padding: '12px 14px', flex: 1, overflow:'auto', minHeight: 0 }}>
              <div className="mono" style={{ fontSize: 10.5, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom: 6 }}>翻译 · {window.LANG_NAME[tgt] || tgt}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.65, color:'var(--text)', whiteSpace:'pre-wrap' }}>
                {`调和分布式状态

当两个副本在分区后产生分歧时，合并函数必须满足结合律和交换律——否则到达操作的顺序就会影响结果，从而不再是一个 CRDT。`}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '12px 14px', overflow:'auto', minHeight: 0 }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.65, color:'var(--text)', whiteSpace:'pre-wrap' }}>
              {`Reconciling Distributed State

When two replicas diverge after a partition, the merge function must be
associative and commutative — otherwise the order of arriving operations
matters and the result is no longer a CRDT.

fig 3.2 — eventual consistency`}
            </div>
          </div>
        )}
      </div>

      {/* Row 3 — action bar
         Recognize:  复制图片 | 系统 OCR | 自动检测 | (spacer) | 翻译 | 去除换行 | 去除空格 | 复制文本 | 导出
         Translate:  复制图片 | 系统 OCR | 自动检测 | swap | 简体中文 | (spacer) | 去除换行 | 去除空格 | 复制文本 | 导出
         All language pickers use a unified pill style
         (background + 1px border) — no transparent dropdowns here. */}
      <div style={{
        display:'flex', alignItems:'center', gap: 6,
        padding: '8px 10px 10px',
        borderTop: '1px solid var(--line-soft)',
      }}>
        <button className="ic-btn" title="复制图片"><Icons.Image size={16}/></button>
        <PillSelect value="system" options={OCR_ENGINES} leading={<SvcTile name="system" />} />
        <PillSelect value="auto" options={OCR_LANGS} />
        {translate && (
          <>
            <Icons.Swap size={18} style={{ color:'var(--text)' }}/>
            <PillSelect value={tgt} onChange={setTgt} options={[
              { value:'zh_cn', label:'简体中文' },
              { value:'zh_tw', label:'繁體中文' },
              { value:'en',    label:'English' },
              { value:'ja',    label:'日本語' },
              { value:'ko',    label:'한국어' },
              { value:'fr',    label:'Français' },
              { value:'de',    label:'Deutsch' },
              { value:'es',    label:'Español' },
            ]} />
          </>
        )}

        <div style={{ flex:1 }} />

        {!translate && (
          <button className="ic-btn brand" title="翻译" style={{ color:'var(--brand-primary)' }}>
            <Icons.Translate size={18}/>
          </button>
        )}
        <button className="ic-btn" title="去除换行"><ReactIcon name="MdSmartButton" size={17}/></button>
        <button className="ic-btn" title="去除空格"><ReactIcon name="CgSpaceBetween" size={17}/></button>
        <button className="ic-btn" title="复制文本"><Icons.Copy size={16}/></button>
        <ExportButton />
      </div>
    </div>
  );
};

// ===== Screenshot overlay (color-restrained, brand only on the selection itself) =====
const ScreenshotOverlay = () => {
  const w = 720, h = 420;
  const sel = { x: 110, y: 90, w: 460, h: 220 };
  return (
    <div style={{ width: w, height: h, position:'relative', background:'#0f0e0c', borderRadius: 12, overflow:'hidden', boxShadow:'0 10px 30px rgba(0,0,0,0.18)' }}>
      <div style={{ position:'absolute', inset:0, background: 'radial-gradient(circle at 20% 30%, oklch(40% 0.08 200), oklch(15% 0.04 60))' }} />
      <div style={{ position:'absolute', left: 60, top: 50, width: 540, height: 280, background:'oklch(96% 0.005 70)', borderRadius: 8, opacity: 0.9, padding: 14, fontFamily:'var(--font-mono)', fontSize: 11, color:'oklch(35% 0.01 60)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Lorem Ipsum (Latin)</div>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.{'\n'}
        Sed do eiusmod tempor incididunt ut labore et dolore.
      </div>
      <div style={{ position:'absolute', inset:0, background:'rgba(10,10,15,0.55)' }} />
      <div style={{ position:'absolute', left: sel.x, top: sel.y, width: sel.w, height: sel.h, border: '1.5px solid var(--brand-primary)', boxShadow: '0 0 0 9999px rgba(10,10,15,0.45)' }}>
        <div style={{ position:'absolute', inset:0, padding: 14, fontFamily:'var(--font-mono)', fontSize: 11, color:'oklch(35% 0.01 60)', background:'oklch(96% 0.005 70 / 0.95)' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color:'oklch(20% 0.01 60)' }}>Lorem Ipsum (Latin)</div>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.<br/>
          Sed do eiusmod tempor incididunt ut labore et dolore.
        </div>
        {[[0,0],[1,0],[0,1],[1,1]].map(([x,y],i) => (
          <div key={i} style={{ position:'absolute', left: x*sel.w-3, top: y*sel.h-3, width: 6, height: 6, background:'var(--brand-primary)', borderRadius: 1 }} />
        ))}
        <div style={{ position:'absolute', right: 4, bottom: -22, fontFamily:'var(--font-mono)', fontSize: 11, color:'#fff', background:'var(--brand-primary)', padding:'2px 6px', borderRadius: 4 }}>
          {sel.w} × {sel.h}
        </div>
      </div>
      <div style={{ position:'absolute', left: '50%', top: 14, transform:'translateX(-50%)', display:'flex', gap: 6, padding: '6px 10px', background:'rgba(20,18,16,0.85)', color:'#f5f3f0', borderRadius: 999, fontFamily:'var(--font-mono)', fontSize: 11 }}>
        <span>拖动选取区域</span>
        <span style={{ color:'oklch(70% 0.01 70)' }}>·</span>
        <span><kbd style={{background:'rgba(255,255,255,.1)', borderColor:'rgba(255,255,255,.2)', color:'#fff'}}>↵</kbd> 确认</span>
        <span style={{ color:'oklch(70% 0.01 70)' }}>·</span>
        <span><kbd style={{background:'rgba(255,255,255,.1)', borderColor:'rgba(255,255,255,.2)', color:'#fff'}}>Esc</kbd> 取消</span>
      </div>
    </div>
  );
};

const UpdaterWindow = () => {
  const downloading = true;
  const progress = 64;
  return (
    <div className="op-window" style={{ width: 600, height: 420 }}>
      <TitlebarLeft mode="更新" pinned={false} noPin />
      <div style={{ padding: '8px 16px 18px', display:'flex', flexDirection:'column', gap: 12, flex:1, overflow:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
          <div className="svc-tile lg" style={{ background:'var(--brand-primary)', color:'#fff', width: 40, height: 40, borderRadius: 10, borderColor:'transparent', fontSize: 14 }}>op</div>
          <div className="stack">
            <div style={{ fontSize: 15, fontWeight: 600 }}>有新版本可用</div>
            <div className="hint mono">3.0.6 → 3.1.0 · 2026-05-09 · 12.4 MB</div>
          </div>
        </div>

        <div className="card" style={{ flex:1, overflow:'auto', padding: 14 }}>
          <div className="mono" style={{ fontSize: 10.5, fontWeight: 600, color:'var(--text-mute)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom: 10 }}>更新日志</div>
          <div style={{ fontSize: 13, lineHeight: 1.65 }}>
            <div style={{fontWeight:600}}>新功能</div>
            <ul style={{margin:'4px 0 10px', paddingLeft: 18, color:'var(--text-dim)'}}>
              <li>新增 <span className="mono">openai_compatible</span> 视觉识别，支持流式输出</li>
              <li>词典窗口支持自定义来源排序</li>
              <li>剪贴板监听新增过滤规则（正则）</li>
            </ul>
            <div style={{fontWeight:600}}>修复</div>
            <ul style={{margin:'4px 0 0', paddingLeft: 18, color:'var(--text-dim)'}}>
              <li>修复 Wayland 下截图坐标偏移问题</li>
              <li>修复 IME 输入与语言检测的竞态</li>
            </ul>
          </div>
        </div>

        {downloading && (
          <div className="stack gap-6">
            <div className="between">
              <div className="mono hint">下载中… 7.9 MB / 12.4 MB</div>
              <div className="mono" style={{fontSize:11, color:'var(--text-dim)'}}>{progress}%</div>
            </div>
            <div style={{ height: 4, borderRadius: 99, background:'var(--bg-sunk)', overflow:'hidden' }}>
              <div style={{ height:'100%', width: progress+'%', background:'var(--brand-primary)' }} />
            </div>
          </div>
        )}

        <div style={{ display:'flex', gap: 8, justifyContent:'flex-end' }}>
          <button className="btn">稍后提醒</button>
          <button className="btn primary">{downloading ? '下载中…' : '立即更新'}</button>
        </div>
      </div>
    </div>
  );
};

const TrayMenu = () => {
  const Item = ({ icon, label, kbd, sub, danger, check }) => (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px', borderRadius: 6, cursor:'pointer', color: danger ? 'var(--danger)' : 'var(--text)' }} onMouseEnter={e=>e.currentTarget.style.background='var(--bg-sunk)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
      {check !== undefined ? (
        <span style={{ width: 14, color: check ? 'var(--brand-primary)' : 'transparent' }}>{check ? <Icons.Check size={12}/> : null}</span>
      ) : (
        <span style={{ width: 14, color: 'var(--text-mute)' }}>{icon}</span>
      )}
      <span style={{ flex:1, fontSize: 13 }}>{label}</span>
      {sub && <Icons.ChevR size={11} style={{color:'var(--text-mute)'}}/>}
      {kbd && <span className="mono" style={{fontSize: 11.5, color:'var(--text-mute)', whiteSpace:'nowrap'}}>{kbd}</span>}
    </div>
  );
  return (
    <div style={{ width: 332, background:'var(--bg-elev)', border:'1px solid var(--line)', borderRadius: 10, padding: 4, boxShadow:'0 12px 32px rgba(0,0,0,0.12)' }}>
      <div style={{ padding:'8px 12px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--line)', marginBottom: 4 }}>
        <div className="op-wordmark">Omni Pot</div>
        <div style={{flex:1}}/>
        <span className="hint mono">3.1.0</span>
      </div>
      <Item icon={<Icons.Translate/>} label="翻译" kbd="Ctrl + Alt + T"/>
      <Item icon={<Icons.Type/>} label="词典" kbd="Ctrl + Alt + D"/>
      <Item icon={<Icons.Camera/>} label="文字识别" kbd="Ctrl + Alt + S"/>
      <Item icon={<Icons.Image/>} label="截图翻译" kbd="Ctrl + Alt + Shift + S"/>
      <div className="div" style={{margin:'4px 8px'}}/>
      <Item check={true} label="剪贴板监听"/>
      <div className="div" style={{margin:'4px 8px'}}/>
      <Item icon={<Icons.Settings/>} label="设置" kbd="Ctrl + Alt + ,"/>
      <Item icon={<Icons.Cloud/>} label="检查更新"/>
      <Item icon={<Icons.Info/>} label="查看日志"/>
      <div className="div" style={{margin:'4px 8px'}}/>
      <Item icon={<Icons.Cycle/>} label="重启"/>
      <Item icon={<Icons.Close/>} label="退出" danger/>
    </div>
  );
};

Object.assign(window, { RecognizeWindow, ScreenshotOverlay, UpdaterWindow, TrayMenu });
