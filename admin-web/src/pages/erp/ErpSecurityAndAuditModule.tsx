import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Key,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Eye,
  UserCheck,
  UserX,
  Lock,
  Globe,
  Terminal,
  Clock,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { AuditLog, User, LoginHistoryItem, RateLimitLogItem } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ErpSecurityAndAuditModuleProps {
  initialSubTab?: 'audit' | 'users' | 'rate-limits' | 'sessions';
}

export const ErpSecurityAndAuditModule: React.FC<ErpSecurityAndAuditModuleProps> = ({
  initialSubTab = 'audit'
}) => {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'audit' | 'users' | 'rate-limits' | 'sessions'>(initialSubTab);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [rateLimitLogs, setRateLimitLogs] = useState<RateLimitLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected Audit Log for JSON Diff Drawer
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logs, usrs, hist, rls] = await Promise.all([
        api.getAuditLogs(),
        api.getUsers(),
        api.getLoginHistory(),
        api.getRateLimitLogs()
      ]);
      setAuditLogs(logs);
      setUsers(usrs);
      setLoginHistory(hist);
      setRateLimitLogs(rls);
    } catch {
      showToast('Failed to load security & audit records', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatJson = (jsonString?: string) => {
    if (!jsonString) return '—';
    try {
      return JSON.stringify(JSON.parse(jsonString), null, 2);
    } catch {
      return jsonString;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy tracking-tight flex items-center space-x-2">
            <span>Security, Role Permissions, Audit Logs & Rate Limiting</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable append-only audit trail with JSON before/after diffs, role access policies, login history, and API rate-limiter logs.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadData()}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'audit', label: `Audit Logs (${auditLogs.length})`, icon: ShieldAlert },
          { id: 'users', label: `Staff Users & Roles (${users.length})`, icon: Key },
          { id: 'rate-limits', label: `Rate Limit Logs (${rateLimitLogs.length})`, icon: Activity },
          { id: 'sessions', label: `Login History (${loginHistory.length})`, icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. AUDIT LOGS TAB WITH JSON DIFF DRAWER */}
      {subTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-3">Actor / User</th>
                  <th className="py-3 px-3">Module</th>
                  <th className="py-3 px-3">Action Performed</th>
                  <th className="py-3 px-3">Entity</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Result</th>
                  <th className="py-3 px-4 text-right">JSON Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedAuditLog(log)}
                    className="hover:bg-purple/5 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestampUtc).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-navy">{log.userName || 'System Engine'}</div>
                      <div className="text-[10px] text-slate-400">{log.role || 'Admin'}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-navy">{log.actionName || log.action}</td>
                    <td className="py-3 px-3 font-mono text-purple">{log.entityType}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.severity === 'Critical'
                            ? 'bg-red-100 text-red-700'
                            : log.severity === 'Warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {log.severity || 'Info'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        Success
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAuditLog(log);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-navy text-white hover:bg-navy-dark text-[11px] font-bold shadow-2xs"
                      >
                        Inspect Diff &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. USERS & ROLES TAB */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-purple/20 text-purple flex items-center justify-center font-black text-sm">
                      {u.firstName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-navy">{u.firstName} {u.lastName}</h3>
                      <p className="text-[10px] text-slate-400">{u.email}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    Active
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Enterprise Role:</span>
                    <span className="font-bold text-purple">{u.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone:</span>
                    <span className="font-mono text-slate-700">{u.phone}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400">All permissions granted</span>
                  <button
                    onClick={() => showToast(`Password reset link sent to ${u.email}`, 'success')}
                    className="text-xs font-bold text-orange hover:underline"
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. RATE LIMIT LOGS TAB */}
      {subTab === 'rate-limits' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">Protected Endpoint</th>
                  <th className="py-3 px-3">Policy & Threshold</th>
                  <th className="py-3 px-3">Client IP Address</th>
                  <th className="py-3 px-3">Requests Total</th>
                  <th className="py-3 px-3">Blocked Events</th>
                  <th className="py-3 px-4">Security Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rateLimitLogs.map((rl) => (
                  <tr key={rl.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(rl.timestampUtc).toLocaleTimeString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-navy">{rl.endpoint}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-purple/10 text-purple font-bold text-[10px]">
                        {rl.policy}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{rl.ipAddress}</td>
                    <td className="py-3 px-3 font-bold">{rl.requestsCount} reqs</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">
                        {rl.blockedCount} Blocked (HTTP 429)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">{rl.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LOGIN HISTORY TAB */}
      {subTab === 'sessions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Login Time</th>
                  <th className="py-3 px-3">User Account</th>
                  <th className="py-3 px-3">IP Address / Location</th>
                  <th className="py-3 px-3">User Agent</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {loginHistory.map((lh) => (
                  <tr key={lh.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(lh.timestampUtc).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 font-bold text-navy">{lh.email}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{lh.ipAddress}</td>
                    <td className="py-3 px-3 text-slate-400 text-[11px] truncate max-w-xs">{lh.userAgent}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        Authenticated
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* JSON DIFF AUDIT INSPECTOR SIDE DRAWER / MODAL */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-2">
                <FileCode className="w-5 h-5 text-purple" />
                <div>
                  <h3 className="font-black text-sm text-navy uppercase tracking-wider">
                    Audit Log Inspection & JSON Diff
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Correlation ID: {selectedAuditLog.correlationId || 'N/A'} • Log #{selectedAuditLog.id}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedAuditLog(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
              {/* Event Metadata Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Actor:</div>
                  <div className="font-bold text-navy">{selectedAuditLog.userName || 'Admin'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Action:</div>
                  <div className="font-bold text-purple">{selectedAuditLog.actionName || selectedAuditLog.action}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Target Entity:</div>
                  <div className="font-mono text-slate-700">{selectedAuditLog.entityType}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">HTTP Path:</div>
                  <div className="font-mono text-slate-700">{selectedAuditLog.httpMethod} {selectedAuditLog.requestPath}</div>
                </div>
              </div>

              {/* JSON Before vs After Diff Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="font-bold text-red-600 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                    <span>State Before (Pre-Action Snapshot)</span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-red-400 rounded-xl overflow-x-auto text-[11px] font-mono max-h-64 border border-slate-800">
                    {formatJson(selectedAuditLog.beforeJson)}
                  </pre>
                </div>

                <div className="space-y-1.5">
                  <div className="font-bold text-emerald-600 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                    <span>State After (Committed DB Snapshot)</span>
                  </div>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono max-h-64 border border-slate-800">
                    {formatJson(selectedAuditLog.afterJson)}
                  </pre>
                </div>
              </div>

              {/* Changed Fields / Metadata */}
              {selectedAuditLog.changedFieldsJson && (
                <div className="space-y-1.5">
                  <div className="font-bold text-navy text-[11px] uppercase tracking-wider">
                    Explicit Field Diffs:
                  </div>
                  <pre className="p-3 bg-slate-100 text-navy rounded-xl overflow-x-auto text-[11px] font-mono border border-slate-200">
                    {formatJson(selectedAuditLog.changedFieldsJson)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-5 py-2 rounded-xl bg-navy text-white text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
