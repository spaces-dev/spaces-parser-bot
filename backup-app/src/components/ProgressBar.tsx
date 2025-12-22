interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  formatValue?: (value: number) => string;
}

export function ProgressBar({ value, max, label, formatValue }: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const displayValue = formatValue ? formatValue(value) : value.toString();
  const displayMax = formatValue ? formatValue(max) : max.toString();
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>{label}</span>
          <span>{displayValue} / {displayMax} ({percentage.toFixed(1)}%)</span>
        </div>
      )}
      <div className="w-full h-2 bg-dark-surface rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

