import { useState } from 'react';
import { useCall } from '../context/CallContext';
import { toast } from '../utils/toast';

export default function IncomingCallModal() {
  const call = useCall();

  // guard: if context missing or no incoming call
  if (!call || !call.incoming) return null;

  const { incoming, acceptCall, rejectCall } = call;
  const [pending, setPending] = useState(null); // 'accept' | 'reject' | null

  const handleAccept = async () => {
    if (pending) return;
    setPending('accept');
    try {
      await acceptCall?.();
      toast.ok('Call started');
    } catch (err) {
      // prefer server message if present
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to accept call';
      toast.err(msg);
      // optional: console.debug(err);
    } finally {
      setPending(null);
    }
  };

  const handleReject = async () => {
    if (pending) return;
    setPending('reject');
    try {
      await rejectCall?.();
      toast.info('Call declined');
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to decline call';
      toast.err(msg);
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Incoming call"
    >
      <div className="bg-white rounded-xl p-6 w-[360px] shadow-xl">
        <h3 className="text-lg font-semibold mb-1">
          Incoming {incoming.mode === 'VIDEO' ? 'Video' : 'Audio'} Call
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          from{' '}
          {incoming.fromUser?.name ??
            (incoming.fromUser?.id
              ? `User ${incoming.fromUser.id}`
              : 'Unknown caller')}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleReject}
            disabled={pending !== null}
            className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-60"
          >
            {pending === 'reject' ? 'Declining…' : 'Decline'}
          </button>
          <button
            onClick={handleAccept}
            disabled={pending !== null}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
          >
            {pending === 'accept' ? 'Connecting…' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
