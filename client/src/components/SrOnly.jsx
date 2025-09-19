export default function SrOnly({ as = 'span', children }) {
  const Comp = as;
  const srOnly = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    whiteSpace: 'nowrap',
    border: 0,
  };
  return <Comp style={srOnly}>{children}</Comp>;
}
