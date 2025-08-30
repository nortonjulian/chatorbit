import { useState } from 'react';

export default function RttSidebar({ callId }) {
  const [lines, setLines] = useState([]);
  const [text, setText] = useState('');

  function send() {
    if (!text.trim()) return;
    // TODO: wire this to your call datachannel or chat transport
    setLines(l => [...l, { id: Date.now(), who: 'me', text }]);
    setText('');
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b bg-white/80">
        <div className="text-sm font-medium">Live Chat (RTT)</div>
        <div className="text-xs text-gray-500">Call {callId}</div>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {lines.map(m => (
          <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${m.who==='me'?'bg-black text-white ml-auto':'bg-gray-100 text-gray-900'}`}>{m.text}</div>
        ))}
      </div>
      <div className="p-2 border-t flex gap-2">
        <input
          className="flex-1 border rounded-xl px-3 py-2"
          placeholder="Type to speak…"
          value={text}
          onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{ if (e.key==='Enter') send(); }}
        />
        <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={send}>Send</button>
      </div>
    </div>
  );
}
