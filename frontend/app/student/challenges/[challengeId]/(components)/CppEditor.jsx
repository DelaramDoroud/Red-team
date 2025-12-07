'use client';

import dynamic from 'next/dynamic';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

export default function CppEditor({ value, onChange }) {
  return (
    <div className='border rounded-xl overflow-hidden'>
      <MonacoEditor
        height='50vh'
        defaultLanguage='cpp'
        theme='vs-dark'
        value={value}
        onChange={(val) => onChange(val ?? '')}
        options={{
          fontSize: 16,
        }}
      />
    </div>
  );
}
