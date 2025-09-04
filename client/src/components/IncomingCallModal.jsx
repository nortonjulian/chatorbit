import { useCall } from '../context/CallContext';

export default function IncomingCallModal() {
  const { incoming, acceptCall, rejectCall } = useCall();
  if (!incoming) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[360px] shadow-xl">
        <h3 className="text-lg font-semibold mb-1">
          Incoming {incoming.mode === 'VIDEO' ? 'Video' : 'Audio'} Call
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          from {incoming.fromUser?.name ?? `User ${incoming.fromUser?.id}`}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={rejectCall}
            className="px-4 py-2 rounded-lg bg-gray-200"
          >
            Decline
          </button>
          <button
            onClick={acceptCall}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
