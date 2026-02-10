import RouterLink from '#components/common/RouterLink';

export default function APPLink({ href, className, children, ...props }) {
  return (
    <RouterLink
      href={href}
      className={`
        px-4 py-2
        rounded-[15px]
        border
        border-primary-600
        text-primary-600
        text-[0.9rem]
        no-underline
        hover:bg-primary-600/10
        transition-colors
        ${className}
      `}
      {...props}
    >
      {children}
    </RouterLink>
  );
}
