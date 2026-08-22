"use client";

interface PracticeSessionBarProps {
  connected: boolean;
  isHost: boolean;
  isFollowing: boolean;
  onClaimHost: () => void;
}

/**
 * Özellik 8 (Senkronize Prova Modu, Bölüm 7 Ajan 9): oturum durumunu ve
 * lider/takipçi rolünü gösterir. "Bu Cihazdan Yönet" tıklanınca bu cihaz
 * kontrolü alır, diğer aynı hesaba bağlı cihazlar otomatik takipçi olur.
 */
export function PracticeSessionBar({
  connected,
  isHost,
  isFollowing,
  onClaimHost,
}: PracticeSessionBarProps) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
      <span className="text-gray-600">
        {!connected && "Prova modu bağlanıyor…"}
        {connected && isHost && "Bu cihaz oturumu yönetiyor"}
        {connected && isFollowing && "Başka bir cihaz oturumu yönetiyor (takip modu)"}
        {connected && !isHost && !isFollowing && "Prova modu hazır — henüz kimse kontrolü almadı"}
      </span>
      {connected && !isHost && (
        <button
          type="button"
          onClick={onClaimHost}
          className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white"
        >
          Bu Cihazdan Yönet
        </button>
      )}
    </div>
  );
}
