import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { getReports } from '../services/api';
import { PROVIDERS, ISSUE_TYPES } from '../config/api';

const ISSUE_COLORS = {
  'No Signal':    { bg: '#FEE2E2', text: '#991B1B' },
  'Slow Internet':{ bg: '#FEF3C7', text: '#92400E' },
  'Call Drop':    { bg: '#EDE9FE', text: '#5B21B6' },
  'No Data':      { bg: '#DBEAFE', text: '#1E40AF' },
};

const PROVIDER_COLORS = {
  MTN: '#FCD34D', Airtel: '#F97316', Glo: '#22C55E', '9mobile': '#3B82F6',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function lagLabel(report) {
  if (!report.occurredAt || !report.timestamp) return null;
  const lagMs = new Date(report.timestamp) - new Date(report.occurredAt);
  const lagMins = Math.round(lagMs / 60000);
  if (lagMins < 5) return null;
  if (lagMins < 60) return `${lagMins}m lag`;
  return `${Math.floor(lagMins / 60)}h lag`;
}

const PAGE_SIZE = 20;

export default function Reports() {
  const [all, setAll]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [provider, setProvider] = useState('');
  const [issueType, setIssueType] = useState('');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getReports({ provider: provider || undefined });
      setAll(res.data ?? []);
      setPage(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => { load(); }, [load]);

  // Client-side filtering
  const filtered = all
    .filter((r) => !issueType || r.issueType === issueType)
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (r.description || '').toLowerCase().includes(q) ||
        (r.provider || '').toLowerCase().includes(q) ||
        (r.issueType || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manual Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Outage reports submitted by mobile users
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Filter size={14} className="text-gray-400 shrink-0" />
            <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="">All providers</option>
              {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
            </Select>
            <Select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
              <option value="">All issue types</option>
              {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Input
              placeholder="Search description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56"
            />
            <span className="ml-auto text-xs text-gray-500">
              {filtered.length} report{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'hsl(var(--border))' }}>
                  {['Provider', 'Issue Type', 'Description', 'Location', 'Occurred At', 'Reported At', 'Lag'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td>
                  </tr>
                )}
                {!loading && paged.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-400">No reports match filters</td>
                  </tr>
                )}
                {paged.map((r) => {
                  const issuePalette = ISSUE_COLORS[r.issueType] ?? { bg: '#F3F4F6', text: '#374151' };
                  const lag = lagLabel(r);
                  const coords = r.location?.coordinates;
                  return (
                    <tr
                      key={r._id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      style={{ borderColor: 'hsl(var(--border))' }}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 font-medium"
                        >
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: PROVIDER_COLORS[r.provider] ?? '#94a3b8' }}
                          />
                          {r.provider}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ backgroundColor: issuePalette.bg, color: issuePalette.text }}
                        >
                          {r.issueType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                        {r.description || <span className="text-gray-300 italic">none</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {coords
                          ? `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(r.occurredAt) !== '—' ? formatDate(r.occurredAt) : (
                          <span className="text-gray-400 italic">same as report</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(r.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        {lag ? (
                          <Badge variant="warning" className="text-xs">{lag}</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
