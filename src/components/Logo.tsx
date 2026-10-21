// The Fine Print wordmark, dark version for the navy sidebar: white text, a mint lens
// with a white outline, and the P in ink so it reads on the mint.
export function Logo({ size = 22, variant = 'wordmark' }: { size?: number; variant?: 'wordmark' | 'mark' }) {
  const lens = (
    <span style={{ position: 'relative', display: 'inline-block', margin: variant === 'mark' ? '0.3em' : '0 0.25em 0 0.52em' }}>
      <svg
        viewBox="0 0 150 150"
        aria-hidden="true"
        focusable="false"
        style={{
          position: 'absolute',
          width: '1.5625em',
          height: '1.5625em',
          left: 'calc(50% - 0.625em)',
          top: 'calc(50% - 0.625em)',
          overflow: 'visible',
        }}
      >
        <circle cx="60" cy="60" r="50" strokeWidth="8" fill="#B4F1DA" stroke="#FFFFFF" />
        <line x1="96" y1="96" x2="126" y2="126" strokeWidth="14" strokeLinecap="round" stroke="#FFFFFF" />
      </svg>
      <span style={{ position: 'relative', color: '#15213B' }}>P</span>
    </span>
  )
  return (
    <span
      role="img"
      aria-label="Fine Print"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: size,
        fontWeight: 800,
        letterSpacing: '-0.035em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: '#FFFFFF',
        padding: '6px 0 8px',
      }}
    >
      {variant === 'mark' ? lens : (
        <>
          Fine{lens}rint
        </>
      )}
    </span>
  )
}
