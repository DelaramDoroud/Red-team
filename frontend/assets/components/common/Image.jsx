export default function Image({
  src,
  alt,
  fill = false,
  style,
  className,
  ...props
}) {
  const resolvedSrc =
    typeof src === 'string'
      ? src
      : (src && typeof src === 'object' && src.src) || '';

  const computedStyle = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }
    : style;

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={computedStyle}
      {...props}
    />
  );
}
