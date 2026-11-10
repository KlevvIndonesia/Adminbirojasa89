import { FinanceContent } from "./FinanceContent";

export function Finance({ defaultTab = "profit" }: { defaultTab?: string }) {
  return (
    <div className="flex-1 flex flex-col space-y-4 w-full min-w-0 text-left content-fluid">
      <FinanceContent tab={defaultTab} />
    </div>
  );
}
