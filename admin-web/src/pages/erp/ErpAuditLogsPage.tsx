import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Code,
  FileJson,
  Key
} from 'lucide-react';
import { AuditLog } from '../../types';
import { api } from '../../services/api';
import { Drawer } from '../../components/common/CommonComponents';

export const ErpAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');

  useEffect(() => {
    api.getAuditLogs().then(setLogs);
  }, []);

  const filtered = logs.filter(l => {
    if (selectedModule !== 'all' && l.module.toLowerCase() !== selectedModule.toLowerCase()) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.actionName.toLowerCase().includes(q) ||
        l.entityName?.toLowerCase().includes(q) ||
        l.correlationId.toLowerCase().includes(q) ||
        l.userName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy">Security & Operational Audit Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable trace records with correlation IDs, masked PII, and before/after JSON diffs.
          </p>
        </div>
      </div>

      {/* Search & Module Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, user, or Correlation ID..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium">Module:</span>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:outline-none"
          >
            <option value="all">All Modules</option>
            <option value="Orders">Orders</option>
            <option value="Inventory">Inventory</option>
            <option value="Catalog">Catalog</option>
            <option value="Finance">Finance</option>
            <option value="Auth">Auth & Security</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module / Entity</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Correlation ID</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4 text-right">JSON Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 font-sans text-slate-500 text-[11px]">
                    {new Date(log.timestampUtc).toLocaleString('en-IN', { hour12: true })}
                  </td>
                  <td className="py-3.5 px-4 font-sans font-bold text-navy">
                    {log.actionName}
                  </td>
                  <td className="py-3.5 px-4 font-sans">
                    <span className="font-semibold text-slate-800">{log.module}</span>
                    {log.entityName && <span className="text-[11px] text-slate-500 block">{log.entityName}</span>}
                  </td>
                  <td className="py-3.5 px-4 font-sans text-slate-700">
                    {log.userName || 'System'}
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-purple font-semibold">{log.correlationId}</td>
                  <td className="py-3.5 px-4 font-sans">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      log.severity === 'Warning' ? 'bg-amber-100 text-amber-700' :
                      log.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-sans">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-3 py-1 rounded-lg bg-navy hover:bg-navy-light text-white text-[11px] font-bold flex items-center space-x-1.5 ml-auto transition-colors"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Diff Drawer */}
      <Drawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `Audit Event: ${selectedLog.actionName}` : ''}
        width="max-w-xl"
      >
        {selectedLog && (
          <div className="space-y-6 text-xs font-sans">
            {/* Metadata Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Correlation ID:</span>
                <span className="font-mono font-bold text-purple">{selectedLog.correlationId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">HTTP Endpoint:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedLog.httpMethod} {selectedLog.requestPath}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Performed By:</span>
                <span className="font-semibold text-navy">{selectedLog.userName} ({selectedLog.role})</span>
              </div>
            </div>

            {/* Changed Fields */}
            {selectedLog.changedFieldsJson && (
              <div>
                <div className="font-bold text-navy mb-1.5 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-orange" />
                  <span>Modified Entity Fields</span>
                </div>
                <div className="p-2.5 rounded-lg bg-orange/10 text-orange font-mono text-[11px] font-semibold">
                  {selectedLog.changedFieldsJson}
                </div>
              </div>
            )}

            {/* Before JSON */}
            {selectedLog.beforeJson && selectedLog.beforeJson !== 'null' && (
              <div>
                <div className="font-bold text-navy mb-1.5">State Before Mutation (Old Values)</div>
                <pre className="p-4 rounded-xl bg-slate-900 text-red-300 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                  {selectedLog.beforeJson}
                </pre>
              </div>
            )}

            {/* After JSON */}
            {selectedLog.afterJson && (
              <div>
                <div className="font-bold text-navy mb-1.5">State After Mutation (New Values)</div>
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                  {selectedLog.afterJson}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
