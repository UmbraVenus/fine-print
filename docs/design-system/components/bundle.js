/* @ds-bundle: {"format":4,"namespace":"FinePrint","components":[{"name":"FinePrintProvider"},{"name":"Logo"},{"name":"StatusTag"},{"name":"ChecksSummary"},{"name":"QueueItem"},{"name":"AdReview"}]} */
(function () {
  var React = window.React, antd = window.antd, h = React.createElement;

  /* The antd theme. Mirrors tokens.json; antd needs literal values, so keep the two in step. */
  var theme = {
    token: {
      colorPrimary: '#0f766e', colorInfo: '#0f766e', colorLink: '#0f766e',
      colorSuccess: '#067647', colorWarning: '#b54708', colorError: '#b42318',
      colorText: '#15213b', colorTextSecondary: '#4a5468', colorTextTertiary: '#4a5468',
      colorTextPlaceholder: '#6b7385',
      colorBorder: '#8a93a6', colorBorderSecondary: '#e3e6ec', colorPrimaryBorder: '#0f766e',
      colorBgLayout: '#f6f7f9', colorBgContainer: '#ffffff',
      borderRadius: 8, borderRadiusLG: 12, borderRadiusSM: 4,
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
      fontFamilyCode: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
      fontSize: 14, controlHeight: 36,
      boxShadow: '0 8px 24px #15213b29'
    },
    components: {
      Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 600 },
      Segmented: { itemSelectedColor: '#15213b' },
      Collapse: { colorBorder: '#e3e6ec' }
    }
  };

  function FinePrintProvider(props) {
    return h(antd.ConfigProvider, { theme: theme }, h(antd.App, { className: 'fp-app' }, props.children));
  }

  /* Small inline icons for status (the app itself uses @ant-design/icons: CloseCircleFilled, ExclamationCircleFilled, CheckCircleFilled). */
  function Icon(kind, size) {
    var s = size || 16, w = '#ffffff', base = { width: s, height: s, viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' };
    if (kind === 'x') return h('svg', base, h('circle', { cx: 8, cy: 8, r: 7, fill: 'currentColor' }), h('path', { d: 'M5.5 5.5l5 5M10.5 5.5l-5 5', stroke: w, strokeWidth: 1.6, strokeLinecap: 'round' }));
    if (kind === 'alert') return h('svg', base, h('path', { d: 'M8 1.6L15 14H1z', fill: 'currentColor', stroke: 'currentColor', strokeWidth: 1, strokeLinejoin: 'round' }), h('path', { d: 'M8 6v3.6', stroke: w, strokeWidth: 1.6, strokeLinecap: 'round' }), h('circle', { cx: 8, cy: 11.8, r: 0.95, fill: w }));
    if (kind === 'check') return h('svg', base, h('circle', { cx: 8, cy: 8, r: 7, fill: 'currentColor' }), h('path', { d: 'M4.8 8.2l2.2 2.2 4.2-4.6', stroke: w, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }));
    if (kind === 'return') return h('svg', base, h('path', { d: 'M6.2 3.5L2.8 7l3.4 3.5', stroke: 'currentColor', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }), h('path', { d: 'M3.2 7h6.3a3.3 3.3 0 0 1 0 6.6H8', stroke: 'currentColor', strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' }));
    if (kind === 'image') return h('svg', base, h('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'none' }), h('circle', { cx: 5.5, cy: 6, r: 1.3, fill: 'currentColor' }), h('path', { d: 'M2 12l4-4 3 3 2-2 3 3', stroke: 'currentColor', strokeWidth: 1.2, fill: 'none', strokeLinejoin: 'round' }));
    if (kind === 'text') return h('svg', base, h('path', { d: 'M2.5 4h11M2.5 7h11M2.5 10h11M2.5 13h7', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }));
    return h('svg', base, h('circle', { cx: 8, cy: 8, r: 3.5, fill: 'currentColor' }));
  }

  var STATUS = {
    /* finding severity */
    'critical': ['critical', 'x', 'Critical'],
    'caution': ['warning', 'alert', 'Caution'],
    'good': ['success', 'check', 'Good'],
    /* asset status: Adobe Workfront's decision words, plus Rejected */
    'pending': ['neutral', 'dot', 'Pending'],
    'changes-required': ['warning', 'return', 'Changes required'],
    'approved-with-changes': ['success', 'check', 'Approved with changes'],
    'approved': ['success', 'check', 'Approved'],
    'rejected': ['critical', 'x', 'Rejected']
  };

  function StatusTag(props) {
    var s = STATUS[props.status] || STATUS['pending'];
    return h(antd.Tag, { className: 'fp-tag fp-tone-' + s[0], icon: Icon(s[1], 14) }, props.label || s[2]);
  }

  function Logo(props) {
    var size = props.size || 24, title = props.title || 'Fine Print';
    var lens = h('svg', { viewBox: '0 0 150 150', 'aria-hidden': 'true', focusable: 'false' },
      h('circle', { className: 'fp-lens', cx: 60, cy: 60, r: 50, strokeWidth: 8 }),
      h('line', { className: 'fp-lens-handle', x1: 96, y1: 96, x2: 126, y2: 126, strokeWidth: 14, strokeLinecap: 'round' }));
    var p = h('span', { className: 'fp-logo-p' }, lens, h('span', null, 'P'));
    if (props.variant === 'mark') {
      return h('span', { className: 'fp-logo fp-logo-mark', role: 'img', 'aria-label': title, style: { fontSize: size } }, p);
    }
    return h('span', { className: 'fp-logo', role: 'img', 'aria-label': title, style: { fontSize: size, paddingBottom: Math.round(size * 0.3) } }, 'Fine', p, 'rint');
  }

  function ChecksSummary(props) {
    var items = props.passedItems || [];
    function count(tone, icon, n, label) {
      return h('span', { className: 'fp-count fp-count-' + tone }, Icon(icon, 18), h('b', null, n), h('span', null, label));
    }
    return h('section', { className: 'fp-stack', 'aria-label': 'Check results' },
      h('div', { className: 'fp-counts' },
        count('critical', 'x', props.critical || 0, 'critical'),
        count('warning', 'alert', props.caution || 0, 'caution'),
        count('success', 'check', props.good || 0, 'good')),
      items.length ? h(antd.Collapse, { size: 'small', items: [{ key: 'good', label: (props.good || items.length) + ' checks look good', children: h('ul', { className: 'fp-passed-list' }, items.map(function (t, i) { return h('li', { key: i }, Icon('check'), t); })) }] }) : null);
  }

  function QueueItem(props) {
    var meta = [props.channel, props.product].filter(Boolean).join(' \u00b7 ');
    return h('button', { type: 'button', className: 'fp-qi', 'aria-current': props.selected ? 'true' : undefined, onClick: props.onClick },
      h('span', { className: 'fp-qi-thumb', 'aria-hidden': 'true' }, props.thumb ? h('img', { src: props.thumb, alt: '' }) : Icon(props.kind === 'text' ? 'text' : 'image', 20)),
      h('span', { className: 'fp-qi-main' },
        h('span', { className: 'fp-qi-titlerow' },
          h('span', { className: 'fp-qi-title' }, props.title),
          props.round > 1 ? h('span', { className: 'fp-qi-ver', title: 'Round ' + props.round }, 'v' + props.round) : null,
          props.sourceKind === 'affiliate' ? h('span', { className: 'fp-qi-chip' }, 'Affiliate') : null),
        meta ? h('span', { className: 'fp-caption' }, meta) : null),
      h('span', { className: 'fp-qi-side' },
        h(StatusTag, { status: props.status, label: props.statusLabel }),
        props.due ? h('span', { className: 'fp-caption fp-qi-due', 'data-overdue': String(!!props.overdue) }, props.overdue ? 'Overdue \u00b7 ' + props.due : 'Due ' + props.due) : null));
  }

  function AdReview(props) {
    var ac = React.useState(props.active), active = ac[0], setActive = ac[1];
    var boxes = props.boxes || [];
    return h('figure', { className: 'fp-ad', style: { width: props.width || 360, margin: 0 } },
      h('img', { src: props.src, alt: props.alt || '' }),
      boxes.map(function (b) {
        return h('button', {
          key: b.n, type: 'button', className: 'fp-box',
          style: { left: b.x + '%', top: b.y + '%', width: b.w + '%', height: b.h + '%' },
          'aria-pressed': String(active === b.n),
          'aria-label': 'Finding ' + b.n + (b.label ? ': ' + b.label : ''),
          onClick: function () { setActive(b.n); if (props.onSelect) props.onSelect(b.n); }
        }, h('span', { className: 'fp-num', 'aria-hidden': 'true' }, b.n));
      }));
  }

  window.FinePrint = Object.assign(window.FinePrint || {}, {
    theme: theme, FinePrintProvider: FinePrintProvider, Logo: Logo, StatusTag: StatusTag,
    ChecksSummary: ChecksSummary, QueueItem: QueueItem, AdReview: AdReview
  });
})();
