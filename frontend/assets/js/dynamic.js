import { createElement, lazy, Suspense } from 'react';

export default function dynamic(loader, options = {}) {
  const LazyComponent = lazy(async () => {
    const module = await loader();
    if (module && typeof module === 'object' && 'default' in module) {
      return module;
    }

    return { default: module };
  });

  function DynamicComponent(props) {
    const fallback =
      typeof options.loading === 'function' ? options.loading() : null;

    return createElement(
      Suspense,
      { fallback },
      createElement(LazyComponent, props)
    );
  }

  DynamicComponent.displayName = 'DynamicComponent';

  return DynamicComponent;
}
