export default function FrequencyDisplay({ mhz }: { mhz: string }) {
  return (
    <div className="freq-display" title="Active frequency">
      <span className="freq-label">COM1</span>
      <span className="freq-value">{mhz}</span>
    </div>
  );
}
