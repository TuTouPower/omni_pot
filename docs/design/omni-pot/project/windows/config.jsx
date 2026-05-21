/* global React, Titlebar, Switch, Select, LangSelect, Flag, SvcTile, Icons, LANG_NAME */
const { useState: useStateC } = React;

const NAV = [
  { id: 'general', label: '通用', icon: <Icons.Grid /> },
  { id: 'translate', label: '翻译', icon: <Icons.Translate /> },
  { id: 'recognize', label: '文字识别', icon: <Icons.Image /> },
  { id: 'hotkey', label: '快捷键', icon: <Icons.Kbd /> },
  { id: 'service', label: '服务', icon: <Icons.Layers /> },
  { id: 'history', label: '历史', icon: <Icons.Clock /> },
  { id: 'backup', label: '备份', icon: <Icons.Cloud /> },
  { id: 'about', label: '关于', icon: <Icons.Info /> },
];

const Row = ({ label, sub, children }) => (
  <div className="row" style={{ minHeight: 36 }}>
    <div className="label">{label}{sub && <span className="sub">{sub}</span>}</div>
    {children}
  </div>
);

const Card = ({ title, hint, children }) => (
  <div className="card">
    <div className="card-head"><span>{title}</span>{hint && <span className="hint mono" style={{textTransform:'none',letterSpacing:0,marginLeft:'auto',fontWeight:400}}>{hint}</span>}</div>
    <div className="card-body">{children}</div>
  </div>
);

// ===== Pages =====
const PRIMARY_OPTIONS = [
  { v:'#c4623a', l:'陶土橙' },
  { v:'#3a6ea5', l:'群青' },
  { v:'#5c8a4f', l:'松绿' },
  { v:'#b8902f', l:'芥末' },
  { v:'#5a9bbf', l:'天蓝' },
];

const PrimaryPicker = () => {
  // Read current value from CSS variable so it reflects external tweaks
  const cur = (typeof window !== 'undefined' && getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim()) || '#5a9bbf';
  const norm = (c) => (c || '').replace(/\s/g,'').toLowerCase();
  const pick = (v) => {
    // Apply locally and notify host so the tweak persists
    document.documentElement.style.setProperty('--brand-primary', v);
    document.documentElement.style.setProperty('--brand-primary-soft', v + '22');
    try { window.parent.postMessage({type:'__edit_mode_set_keys', edits:{primary: v}}, '*'); } catch(e) {}
  };
  return (
    <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
      {PRIMARY_OPTIONS.map(o => {
        const active = norm(o.v) === norm(cur);
        return (
          <button key={o.v} title={o.l} onClick={()=>pick(o.v)}
            style={{
              width: 22, height: 22, borderRadius: 99,
              background: o.v,
              border: '2px solid '+(active ? 'var(--text)' : 'transparent'),
              boxShadow: active ? '0 0 0 1px var(--bg-elev) inset' : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              cursor:'pointer', padding: 0,
            }} />
        );
      })}
    </div>
  );
};

const FONT_OPTIONS = [
  { value:'default', label:'系统默认', stack:'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { value:'geist',   label:'Geist',     stack:'"Geist", system-ui, sans-serif' },
  { value:'inter',   label:'Inter',     stack:'"Inter", system-ui, sans-serif' },
  { value:'sf',      label:'SF Pro',    stack:'-apple-system, "SF Pro Text", system-ui, sans-serif' },
  { value:'noto',    label:'Noto Sans CJK', stack:'"Noto Sans CJK SC", "Noto Sans SC", system-ui, sans-serif' },
];

const ThemeSeg = ({ value, onChange }) => {
  const opts = [
    { v:'auto',  l:'跟随系统' },
    { v:'light', l:'浅色' },
    { v:'dark',  l:'深色' },
  ];
  return (
    <div style={{ display:'flex', gap: 4, padding: 3, background:'var(--bg-card)', borderRadius: 8, border:'1px solid var(--line-soft)' }}>
      {opts.map(o => {
        const active = value === o.v;
        return (
          <button key={o.v} onClick={()=>onChange && onChange(o.v)}
            style={{
              height: 26, padding: '0 14px', display:'flex', alignItems:'center', gap: 6,
              borderRadius: 6, cursor:'pointer',
              background: active ? 'var(--bg-elev)' : 'transparent',
              border: '1px solid '+(active ? 'var(--line)' : 'transparent'),
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              color: active ? 'var(--text)' : 'var(--text-dim)',
              fontSize: 12.5, fontWeight: active ? 500 : 400,
            }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
};

const PageGeneral = () => {
  const [autostart, setAutostart] = useStateC(true);
  const [check, setCheck] = useStateC(true);
  const [transparent, setTransparent] = useStateC(true);
  const [proxy, setProxy] = useStateC(false);
  const [theme, setTheme] = useStateC('auto');
  const [fontFamily, setFontFamily] = useStateC('default');
  const [fontSize, setFontSize] = useStateC('13');
  const fontMeta = FONT_OPTIONS.find(f => f.value === fontFamily) || FONT_OPTIONS[0];
  return (
    <div className="stack gap-12">
      <Card title="应用">
        <Row label="开机自启" sub="登录系统后在后台启动 Omni Pot"><Switch on={autostart} onChange={setAutostart}/></Row>
        <Row label="启动时检查更新"><Switch on={check} onChange={setCheck}/></Row>
        <Row label="界面语言">
          <Select value="zh_CN" options={[{value:'zh_CN',label:'简体中文'},{value:'zh_TW',label:'繁體中文'},{value:'en',label:'English'},{value:'ja_JP',label:'日本語'},{value:'ko_KR',label:'한국어'},{value:'fr_FR',label:'Français'},{value:'de_DE',label:'Deutsch'}]} style={{width:180}}/>
        </Row>
        <div className="row" style={{ minHeight: 36 }}>
          <div className="label">
            <span style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
              本地 API 端口
              <a href="https://omnipot.example.com/docs/api" target="_blank" rel="noopener" title="查看 API 文档"
                style={{
                  width: 14, height: 14, borderRadius: 99,
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  border: '1px solid var(--line)',
                  color: 'var(--text-mute)',
                  background: 'transparent',
                  fontSize: 9.5, fontWeight: 600, lineHeight: 1,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer', textDecoration:'none',
                  transition: 'color .12s, border-color .12s',
                  flex: '0 0 14px',
                }}
                onMouseEnter={e => { e.currentTarget.style.color='var(--brand-primary)'; e.currentTarget.style.borderColor='var(--brand-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.color='var(--text-mute)'; e.currentTarget.style.borderColor='var(--line)'; }}>
                ?
              </a>
            </span>
            <span className="sub">供外部脚本调用，修改后需重启</span>
          </div>
          <div className="field" style={{ width: 180 }}><input className="mono" defaultValue="20202" /></div>
        </div>
      </Card>

      <Card title="外观">
        <Row label="主题">
          <ThemeSeg value={theme} onChange={setTheme}/>
        </Row>
        <Row label="文字">
          <div style={{ display:'flex', gap: 6 }}>
            <Select
              value={fontFamily}
              onChange={setFontFamily}
              options={FONT_OPTIONS.map(f => ({ value: f.value, label: f.label }))}
              style={{minWidth:180}}/>
            <Select
              value={fontSize}
              onChange={setFontSize}
              options={[{value:'12',label:'12 px'},{value:'13',label:'13 px'},{value:'14',label:'14 px'},{value:'15',label:'15 px'},{value:'16',label:'16 px'}]}
              style={{minWidth:110}}/>
          </div>
        </Row>
        <Row label="主色调" sub="应用于按钮、链接与高亮等强调元素"><PrimaryPicker/></Row>
        <Row label="透明背景" sub="毛玻璃效果，部分平台可能影响性能"><Switch on={transparent} onChange={setTransparent}/></Row>
      </Card>
    </div>
  );
};

const PageTranslate = () => {
  const [stateMap, setStateMap] = useStateC({ auto_copy:false, history:false, incr:false, dyn:false, del:true, remember:false, pos:'mouse', size:true, blur:true, top:false, hideS:false, hideL:false, hideW:false });
  const set = (k,v) => setStateMap(s => ({...s, [k]: v}));
  return (
    <div className="stack gap-12">
      <Card title="语言">
        <Row label="源语言"><LangSelect value="auto" codes={['auto','en','zh_cn','ja','ko']} style={{minWidth:180}}/></Row>
        <Row label="目标语言"><LangSelect value="zh_cn" codes={['zh_cn','en','ja','ko','fr']} style={{minWidth:180}}/></Row>
        <Row label="第二语言" sub="检测到目标语言相同时切换到此语言"><LangSelect value="en" codes={['en','zh_cn','ja']} style={{minWidth:180}}/></Row>
      </Card>

      <Card title="行为">
        <Row label="自动复制"><Switch on={stateMap.auto_copy} onChange={v=>set('auto_copy',v)}/></Row>
        <Row label="增量翻译" sub="新选取的文本追加到现有源文本而非替换"><Switch on={stateMap.incr} onChange={v=>set('incr',v)}/></Row>
        <Row label="动态翻译" sub="输入时自动翻译（1s 防抖）"><Switch on={stateMap.dyn} onChange={v=>set('dyn',v)}/></Row>
        <Row label="自动去除换行"><Switch on={stateMap.del} onChange={v=>set('del',v)}/></Row>
        <Row label="禁用历史记录"><Switch on={stateMap.history} onChange={v=>set('history',v)}/></Row>
      </Card>

      <Card title="窗口">
        <Row label="窗口位置">
          <Select value={stateMap.pos} onChange={v=>set('pos',v)} options={[{value:'mouse',label:'鼠标位置'},{value:'pre_state',label:'上次位置'}]} style={{minWidth:160}}/>
        </Row>
        <Row label="记住窗口大小"><Switch on={stateMap.size} onChange={v=>set('size',v)}/></Row>
        <Row label="失焦时关闭"><Switch on={stateMap.blur} onChange={v=>set('blur',v)}/></Row>
        <Row label="始终置顶"><Switch on={stateMap.top} onChange={v=>set('top',v)}/></Row>
        <Row label="隐藏源文本"><Switch on={stateMap.hideS} onChange={v=>set('hideS',v)}/></Row>
        <Row label="隐藏语言选择"><Switch on={stateMap.hideL} onChange={v=>set('hideL',v)}/></Row>
        <Row label="翻译后隐藏窗口" sub="后台完成翻译并通过通知告知"><Switch on={stateMap.hideW} onChange={v=>set('hideW',v)}/></Row>
      </Card>
    </div>
  );
};

const PageRecognize = () => {
  const [s, setS] = useStateC({ rmNL:false, copy:true, blur:true, hide:true });
  const set = (k,v) => setS(p => ({...p, [k]:v}));
  return (
    <div className="stack gap-12">
      <Card title="识别">
        <Row label="默认识别引擎">
          <Select value="system" options={[
            {value:'system',label:'系统识别'},
            {value:'tesseract',label:'Tesseract'},
            {value:'openai_compatible',label:'AI 视觉 · Qwen2.5-VL'},
            {value:'baidu_accurate_ocr',label:'百度高精度'},
          ]} style={{width:220}}/>
        </Row>
        <Row label="默认识别语言"><LangSelect value="auto" codes={['auto','en','zh_cn','zh_tw','ja','ko','fr','de','es']} style={{width:220}}/></Row>
        <Row label="自动去除换行" sub="识别后合并被物理换行打断的段落"><Switch on={s.rmNL} onChange={v=>set('rmNL',v)}/></Row>
        <Row label="自动复制"><Switch on={s.copy} onChange={v=>set('copy',v)}/></Row>
      </Card>
    </div>
  );
};

const PageHotkey = () => {
  const HK = ({label, sub, value}) => {
    const valid = !!value;
    const subs = Array.isArray(sub) ? sub : (sub ? [sub] : []);
    return (
      <div className="row" style={{ minHeight: 44, alignItems: 'flex-start', paddingTop: 4, paddingBottom: 4 }}>
        <div className="label" style={{ paddingTop: 6 }}>{label}{subs.map((s, i) => <span key={i} className="sub">{s}</span>)}</div>
        <div style={{ display:'flex', gap: 8, alignItems:'center', flex:'0 0 auto' }}>
          <div className="field" style={{ width: 240, height: 32, gap: 4, justifyContent: 'flex-start', cursor:'pointer', padding: '0 10px' }}>
            {valid
              ? value.split('+').map((k,i,a) => <React.Fragment key={i}><kbd>{k}</kbd>{i<a.length-1 && <span className="hint" style={{ margin: '0 2px' }}>+</span>}</React.Fragment>)
              : <span className="hint">点击输入快捷键…</span>}
          </div>
          <button className="btn sm" style={{ height: 32, width: 64, justifyContent:'center', color: valid ? 'var(--danger)' : undefined }}>
            {valid ? '解绑' : '绑定'}
          </button>
        </div>
      </div>
    );
  };
  return (
    <div className="stack gap-12">
      <Card title="全局快捷键" hint="按下组合键以录入 · Backspace 清除">
        <HK label="翻译" sub={['选中文本时翻译该文本；','未选中时弹出空翻译窗口供输入；','剪贴板监听时，自动翻译剪贴板。']} value="Ctrl+Alt+T" />
        <HK label="词典" sub="选中字词查询词典释义" value="Ctrl+Alt+D" />
        <HK label="文字识别" sub="截图后将文字提取到识别窗口" value="Ctrl+Alt+S" />
        <HK label="截图翻译" sub="截图、识别并自动翻译" value="" />
      </Card>
    </div>
  );
};

const PageService = () => {
  const [tab, setTab] = useStateC('translate');
  const tabs = [
    { id:'translate', label:'翻译', count: 5 },
    { id:'dict_zh', label:'中文词典', count: 2 },
    { id:'dict_en', label:'英文词典', count: 3 },
    { id:'recognize', label:'文字识别', count: 2 },
    { id:'tts', label:'语音朗读', count: 1 },
    { id:'collection', label:'收藏', count: 1 },
  ];
  const data = {
    translate: [
      { key:'deepl', enabled: true },
      { key:'bing', enabled: true },
      { key:'google', enabled: true },
      { key:'lingva', enabled: true },
      { key:'mymemory', enabled: true },
    ],
    dict_zh: [
      { key:'chinese_dictionary', enabled: true, tag:'OFFLINE' },
      { key:'ecdict', enabled: true, tag:'OFFLINE' },
    ],
    dict_en: [
      { key:'cambridge_dict', enabled: true },
      { key:'ecdict', enabled: true, tag:'OFFLINE' },
      { key:'free_dictionary', enabled: false },
    ],
    recognize: [
      { key:'system', enabled: true, tag:'PLATFORM' },
      { key:'openai_compatible@v', name:'openai_compatible', label:'Qwen2.5-VL · SiliconFlow', enabled: true },
    ],
    tts: [
      { key:'edge_tts', enabled: true },
    ],
    collection: [
      { key:'anki', enabled: true },
    ],
  };
  const items = data[tab];
  return (
    <div className="stack gap-12">
      {/* Tabs */}
      <div style={{ display:'flex', gap: 4, padding: 4, background:'var(--bg-card)', borderRadius: 8, border:'1px solid var(--line-soft)', alignSelf:'flex-start' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} className="btn sm"
            style={{ background: tab===t.id ? 'var(--bg-elev)' : 'transparent', border:'1px solid '+(tab===t.id?'var(--line)':'transparent'), boxShadow: tab===t.id ? '0 1px 2px rgba(0,0,0,0.04)' : 'none', height: 26 }}>
            {t.label}
            <span className="mono" style={{ fontSize: 10, color:'var(--text-mute)', marginLeft: 2 }}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <span>已启用服务</span>
          <span className="hint mono" style={{textTransform:'none',letterSpacing:0,marginLeft:'auto',fontWeight:400}}>拖动排序 · 顶部优先</span>
        </div>
        <div style={{ padding: 4 }}>
          {items.map((s, i) => {
            const meta = window.SVC_META[s.name || s.key] || {};
            return (
              <div key={s.key} style={{ display:'flex', alignItems:'center', gap: 10, padding: '10px 12px', borderRadius: 8, transition:'background .12s' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <Icons.Drag size={14} style={{ color:'var(--text-mute)', cursor:'grab' }}/>
                <SvcTile name={s.name || s.key} />
                <div className="stack" style={{ flex:1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.label || meta.name || s.key}</div>
                  <div className="hint mono" style={{ fontSize: 10.5 }}>{s.key}</div>
                </div>
                {s.tag && <span className="chip mono" style={{fontSize:9.5}}>{s.tag}</span>}
                <Switch on={s.enabled} />
                <button className="btn ghost sm" title="编辑"><Icons.Edit size={14}/><span>编辑</span></button>
                <button className="btn ghost sm" style={{color:'var(--danger)'}} title="删除"><Icons.Trash size={14}/><span>删除</span></button>
              </div>
            );
          })}
        </div>
        <div className="div" />
        <div style={{ padding: 10, display:'flex', gap: 8 }}>
          <button className="btn sm"><Icons.Plus size={12}/>添加内置服务</button>
        </div>
      </div>
    </div>
  );
};

const PageHistory = () => {
  const [enabled, setEnabled] = useStateC(true);
  const rows = [
    { svc:'deepl', src:'reconcile', from:'en', to:'zh_cn', dst:'调和；使一致', t:'2 分钟前' },
    { svc:'openai', src:'The function must be associative and commutative', from:'en', to:'zh_cn', dst:'该函数必须满足结合律与交换律', t:'5 分钟前' },
    { svc:'google', src:'eventual consistency', from:'en', to:'zh_cn', dst:'最终一致性', t:'8 分钟前' },
    { svc:'free_dictionary', src:'idiosyncrasy', from:'en', to:'zh_cn', dst:'特质；癖好', t:'今天 14:32' },
    { svc:'mymemory', src:'走り抜ける', from:'ja', to:'zh_cn', dst:'跑着穿过', t:'今天 11:08' },
    { svc:'geminipro', src:'お腹が空いた', from:'ja', to:'en', dst:"I'm hungry", t:'昨天 22:11' },
    { svc:'lingva', src:'machen', from:'de', to:'zh_cn', dst:'制作；做', t:'昨天 16:45' },
  ];
  return (
    <div className="stack gap-12">
      <div style={{ display:'flex', gap: 8, alignItems:'center' }}>
        <div style={{
          display:'flex', alignItems:'center', gap: 8,
          height: 32, padding: '0 10px',
          background:'var(--bg-card)',
          border:'1px solid var(--line-soft)',
          borderRadius: 'var(--r-md)',
          flex: '0 0 auto',
        }} title="关闭后不再写入新记录">
          <span style={{ fontSize: 12.5, color: enabled ? 'var(--text)' : 'var(--text-dim)', fontWeight: 500 }}>启用</span>
          <Switch on={enabled} onChange={setEnabled}/>
        </div>
        <div className="field" style={{ flex:1, minWidth: 0, opacity: enabled ? 1 : 0.5 }}>
          <Icons.Search size={13} style={{ color:'var(--text-mute)' }}/>
          <input placeholder="搜索…" disabled={!enabled}/>
        </div>
        <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none', flex:'0 0 auto' }}>
          <Select value="all" options={[{value:'all',label:'全部服务'},{value:'deepl',label:'DeepL'}]} style={{minWidth:110}}/>
        </div>
        <div style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none', flex:'0 0 auto' }}>
          <Select value="month" options={[{value:'today',label:'今天'},{value:'week',label:'本周'},{value:'month',label:'本月'}]} style={{minWidth:90}}/>
        </div>
        <button className="btn sm danger" disabled={!enabled} style={{ opacity: enabled ? 1 : 0.5, flex:'0 0 auto' }}><Icons.Trash size={12}/>清空</button>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px 1fr 100px', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid var(--line-soft)', background:'var(--bg-card)', fontSize: 11, color:'var(--text-mute)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'.05em' }}>
          <div></div><div>源文本</div><div>语言</div><div>译文</div><div>时间</div>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'32px 1fr 80px 1fr 100px', alignItems:'center', padding:'10px 14px', borderBottom: i<rows.length-1?'1px solid var(--line-soft)':'none', cursor:'pointer', transition:'background .12s', gap: 12 }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-card)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <SvcTile name={r.svc} />
            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize: 13 }}>{r.src}</div>
            <div style={{ display:'flex', alignItems:'center', gap: 4 }}><Flag code={r.from}/><Icons.ChevR size={10} style={{color:'var(--text-mute)'}}/><Flag code={r.to}/></div>
            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize: 13, color:'var(--text-dim)' }}>{r.dst}</div>
            <div className="hint mono" style={{fontSize: 11}}>{r.t}</div>
          </div>
        ))}
      </div>
      <div className="between">
        <div className="hint mono">显示 1 – 7 / 共 2,148 条</div>
        <div style={{ display:'flex', gap: 4 }}>
          <button className="btn ghost icon sm" disabled><Icons.Chev style={{transform:'rotate(90deg)'}} size={12}/></button>
          <button className="btn sm" style={{background:'var(--brand-primary-soft)',color:'var(--brand-primary)',borderColor:'transparent'}}>1</button>
          <button className="btn ghost sm">2</button>
          <button className="btn ghost sm">3</button>
          <button className="btn ghost sm">…</button>
          <button className="btn ghost sm">108</button>
          <button className="btn ghost icon sm"><Icons.Chev style={{transform:'rotate(-90deg)'}} size={12}/></button>
        </div>
      </div>
    </div>
  );
};

const PageBackup = () => {
  const [type, setType] = useStateC('webdav');
  return (
    <div className="stack gap-12">
      <Card title="备份目标">
        <div style={{ display:'flex', gap: 8 }}>
          {[
            { v:'webdav', l:'WebDAV', s:'同步到任意 WebDAV 服务器' },
            { v:'local', l:'本地文件', s:'导出 ZIP 到本地路径' },
          ].map(o => (
            <button key={o.v} onClick={()=>setType(o.v)} style={{ flex:1, padding: 12, borderRadius: 10, border: '1px solid '+(type===o.v?'var(--brand-primary)':'var(--line)'), background: type===o.v?'var(--brand-primary-soft)':'var(--bg-elev)', textAlign:'left', cursor:'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: type===o.v?'var(--brand-primary)':'var(--text)' }}>{o.l}</div>
              <div className="hint" style={{ marginTop: 2 }}>{o.s}</div>
            </button>
          ))}
        </div>
      </Card>

      {type==='webdav' && (
        <Card title="WebDAV 连接">
          <Row label="服务器地址"><div className="field" style={{minWidth: 280}}><input placeholder="https://dav.example.com/dav" /></div></Row>
          <Row label="用户名"><div className="field" style={{minWidth: 280}}><input /></div></Row>
          <Row label="密码"><div className="field" style={{minWidth: 280}}><input type="password" defaultValue="••••••••••" /></div></Row>
          <div className="row" style={{ marginTop: 4 }}>
            <div style={{flex:1}}/>
            <button className="btn sm">测试连接</button>
          </div>
        </Card>
      )}

      {type==='local' && (
        <Card title="本地路径">
          <Row label="备份目录"><div className="field" style={{minWidth: 320}}><input className="mono" defaultValue="~/Documents/OmniPotBackups" /></div></Row>
        </Card>
      )}

      <Card title="操作">
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn primary"><Icons.Cloud size={14}/>立即备份</button>
          <button className="btn"><Icons.Cycle size={14}/>从备份恢复</button>
        </div>
        <div className="hint">备份内容：设置、历史记录数据库、CC-CEDICT 词典数据库</div>
      </Card>

      <Card title="最近备份">
        {[
          { t:'2026-05-09 22:14', size:'248 KB', loc:'WebDAV' },
          { t:'2026-05-02 09:30', size:'241 KB', loc:'WebDAV' },
          { t:'2026-04-25 18:02', size:'232 KB', loc:'WebDAV' },
        ].map((b, i) => (
          <div key={i} className="row" style={{ paddingBottom: 8, borderBottom: i<2?'1px solid var(--line)':'none' }}>
            <Icons.Cloud size={14} style={{ color:'var(--text-mute)' }}/>
            <div style={{ flex:1 }}>
              <div className="mono" style={{fontSize: 12}}>backup_{b.t.replace(/[: -]/g,'')}.zip</div>
              <div className="hint" style={{marginTop: 2}}>{b.t} · {b.size}</div>
            </div>
            <button className="btn ghost icon sm"><Icons.Copy size={12}/></button>
            <button className="btn ghost icon sm" style={{color:'var(--danger)'}}><Icons.Trash size={12}/></button>
          </div>
        ))}
      </Card>
    </div>
  );
};

const PageAbout = () => (
  <div className="stack gap-12">
    <div style={{ padding: 28, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap: 8 }}>
      <div className="svc-tile" style={{ width: 64, height: 64, borderRadius: 16, background:'var(--brand-primary)', color:'#fff', borderColor:'transparent', fontSize: 22, fontWeight: 700 }}>op</div>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing:'-0.01em' }}>Omni Pot</div>
      <div className="hint mono">version 3.1.0 · darwin-arm64</div>
      <div className="hint" style={{ maxWidth: 360 }}>一个面向日常使用的桌面翻译与识别工具，覆盖主流在线翻译、离线词典与文字识别服务，开箱即用。</div>
      <div style={{ display:'flex', gap: 6, marginTop: 4 }}>
        <button className="btn sm">官网</button>
        <button className="btn sm">文档</button>
        <button className="btn sm">反馈</button>
        <button className="btn primary sm"><Icons.Cloud size={12}/>检查更新</button>
      </div>
    </div>

    <Card title="诊断">
      <Row label="日志目录"><div className="mono hint" style={{ marginRight: 8 }}>~/Library/Logs/OmniPot</div><button className="btn ghost icon sm" title="复制路径"><Icons.Copy size={12}/></button></Row>
      <Row label="设置目录"><div className="mono hint" style={{ marginRight: 8 }}>~/Library/Application Support/OmniPot</div><button className="btn ghost icon sm" title="复制路径"><Icons.Copy size={12}/></button></Row>
      <Row label="本机 API"><div className="mono hint" style={{ marginRight: 8 }}>http://127.0.0.1:20202</div><button className="btn ghost icon sm" title="复制路径"><Icons.Copy size={12}/></button></Row>
      <Row label="日志" sub="最近 7 天的日志打包为 zip，可附在反馈中"><button className="btn sm"><Icons.Export size={12}/>导出日志</button></Row>
    </Card>
  </div>
);

const PAGES = { general: PageGeneral, translate: PageTranslate, recognize: PageRecognize, hotkey: PageHotkey, service: PageService, history: PageHistory, backup: PageBackup, about: PageAbout };

const ConfigWindow = ({ initial = 'translate' }) => {
  const [page, setPage] = useStateC(initial);
  const Page = PAGES[page];
  const cur = NAV.find(n => n.id === page);
  return (
    <div className="op-window" style={{ width: '100%', height: '100%' }}>
      {/* Settings has no pin/lock — it's a regular app window with the
         standard min/max/close trio in the top-right. */}
      <TitlebarLeft mode={'设置 · ' + (cur?.label || '')} noPin chrome="wmctl" />
      <div style={{ display:'flex', flex:1, minHeight: 0, padding: '0 0 10px 10px', gap: 0 }}>
        {/* Sidebar — narrower (no pin row anymore, content starts at the top) */}
        <div style={{ width: 132, background: 'var(--bg-card)', borderRight: '1px solid var(--line-soft)', display:'flex', flexDirection:'column' }}>
          <div style={{ padding: '8px 6px', display:'flex', flexDirection:'column', gap: 2, flex:1 }}>
            {NAV.map(n => (
              <button key={n.id} onClick={()=>setPage(n.id)}
                style={{ height: 30, padding: '0 10px', borderRadius: 8, display:'flex', alignItems:'center', gap: 10,
                  background: page===n.id?'var(--bg-elev)':'transparent',
                  border:'1px solid '+(page===n.id?'var(--line-soft)':'transparent'),
                  color: page===n.id?'var(--text)':'var(--text-dim)',
                  fontSize: 13, fontWeight: page===n.id?500:400, cursor:'pointer', transition:'background .12s, color .12s' }}>
                <span style={{ color: page===n.id?'var(--brand-primary)':'var(--text-mute)' }}>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop:'1px solid var(--line-soft)' }}>
            <div className="hint mono" style={{ fontSize: 10.5 }}>v3.1.0</div>
          </div>
        </div>
        {/* Content */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth: 0 }}>
          <div style={{ flex:1, overflow:'auto', padding: '12px 16px 16px' }}>
            <Page />
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { ConfigWindow });
