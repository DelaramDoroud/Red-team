import { Link as ReactRouterLink, useInRouterContext } from 'react-router-dom';

export default function RouterLink({
  href,
  to,
  replace = false,
  children,
  ...props
}) {
  const inRouterContext = useInRouterContext();
  const target = to || href || '/';

  if (!inRouterContext) {
    return (
      <a href={target} {...props}>
        {children}
      </a>
    );
  }

  return (
    <ReactRouterLink to={target} replace={replace} {...props}>
      {children}
    </ReactRouterLink>
  );
}
