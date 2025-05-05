import { useConnectionStatus } from "@/lib/hooks";

export function ConnectionStatus() {
  const { isConnected, timeSinceUpdate } = useConnectionStatus();

  return (
    <div className="p-4 border-t border-sidebar-border">
      <div className="flex items-center text-sm">
        <div className={`rounded-full w-2 h-2 mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-muted-foreground">
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {timeSinceUpdate}
        </span>
      </div>
    </div>
  );
}
