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
  Layers,
  Plus,
  Pencil
} from 'lucide-react';
import { AuditLog, User, LoginHistoryItem, RateLimitLogItem } from '../../types';
import { api, authApi, getApiErrorDetails } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { ErpConfirmDialog } from './ErpConfirmDialog';

const ASSIGNABLE_ROLES = [
  'SuperAdmin',
  'Admin',
  'Manager',
  'SalesExecutive',
  'InventoryManager',
  'PurchaseManager',
  'Accountant',
  'SupportAgent'
] as const;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SuperAdmin: 'Full system access including user role management, security policies and audit controls.',
  Admin: 'Full operational access across catalog, orders, inventory, purchases and reports.',
  Manager: 'Oversees daily store operations — orders, customers, inventory and business reports.',
  SalesExecutive: 'Creates and manages orders, quotes and customer accounts for the sales desk.',
  InventoryManager: 'Controls stock levels, adjustments, warehouse transfers and low stock replenishment.',
  PurchaseManager: 'Manages suppliers, purchase orders, goods receipts and procurement workflows.',
  Accountant: 'Handles invoices, payments, supplier bills, expenses and financial statements.',
  SupportAgent: 'Views orders and assists customers with returns, refunds and support queries.'
};

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

  // Users & Roles management state
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: User; newRole: string } | null>(null);
  const [statusToggleTarget, setStatusToggleTarget] = useState<User | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  // Users | Roles inner tabs (spec 12) + admin Add User modal + inline role editing
  const [usersInnerTab, setUsersInnerTab] = useState<'users' | 'roles'>('users');
  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Manager'
  });

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

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget) return;
    const { user, newRole } = roleChangeTarget;
    setSavingUserId(user.id);
    try {
      await authApi.updateUserRole(user.id, newRole);
      showToast(`${user.firstName} ${user.lastName} is now ${newRole}`, 'success');
      setRoleChangeTarget(null);
      setEditingRoleUserId(null);
      const usrs = await api.getUsers();
      setUsers(usrs);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to update user role', 'error');
      setRoleChangeTarget(null);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateUser = async () => {
    const { firstName, lastName, email, password, role } = addUserForm;
    if (!firstName.trim() || !email.trim() || !password.trim() || !role) {
      showToast('Name, email, role and a temporary password are required', 'warning');
      return;
    }
    setIsCreatingUser(true);
    try {
      await authApi.createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        role
      });
      showToast(`User ${firstName.trim()} created — they can sign in with the temporary password`, 'success');
      setIsAddUserOpen(false);
      setAddUserForm({ firstName: '', lastName: '', email: '', password: '', role: 'Manager' });
      const usrs = await api.getUsers();
      setUsers(usrs);
    } catch {
      showToast('Could not create user', 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusToggleTarget) return;
    const user = statusToggleTarget;
    const nextActive = !user.isActive;
    setSavingUserId(user.id);
    try {
      await authApi.updateUserStatus(user.id, nextActive);
      showToast(
        `${user.firstName} ${user.lastName} ${nextActive ? 'activated' : 'deactivated'} successfully`,
        'success'
      );
      setStatusToggleTarget(null);
      const usrs = await api.getUsers();
      setUsers(usrs);
    } catch (error) {
      const { message } = getApiErrorDetails(error);
      showToast(message || 'Failed to update user status', 'error');
      setStatusToggleTarget(null);
    } finally {
      setSavingUserId(null);
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

      {/* 2. USERS & ROLES TAB (spec 12: inner Users | Roles tabs + purple Add User) */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto flex-1">
              {([
                { id: 'users', label: `Users (${users.length})` },
                { id: 'roles', label: 'Roles' }
              ] as { id: 'users' | 'roles'; label: string }[]).map((t) => {
                const isActive = usersInnerTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setUsersInnerTab(t.id)}
                    className={`pb-2.5 pt-1 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      isActive ? 'border-purple text-purple' : 'border-transparent text-slate-500 hover:text-navy'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="px-4 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-purple/20 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>

          {usersInnerTab === 'users' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-purple/15 text-purple flex items-center justify-center font-black text-xs shrink-0">
                            {(u.firstName || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-navy">{u.firstName} {u.lastName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{u.phone || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{u.email}</td>
                      <td className="py-3 px-3">
                        {editingRoleUserId === u.id ? (
                          <select
                            value={ASSIGNABLE_ROLES.includes(u.role as (typeof ASSIGNABLE_ROLES)[number]) ? u.role : ''}
                            disabled={savingUserId === u.id}
                            onChange={(e) => {
                              const newRole = e.target.value;
                              if (newRole && newRole !== u.role) {
                                setRoleChangeTarget({ user: u, newRole });
                              }
                            }}
                            className="bg-white border border-purple/40 rounded-lg px-2 py-1.5 text-xs font-bold text-navy outline-none disabled:opacity-50"
                            title={ROLE_DESCRIPTIONS[u.role] || 'Select role'}
                          >
                            {!ASSIGNABLE_ROLES.includes(u.role as (typeof ASSIGNABLE_ROLES)[number]) && (
                              <option value="">{u.role || 'Unassigned'}</option>
                            )}
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r.replace(/([a-z])([A-Z])/g, '$1 $2')}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-bold text-navy" title={ROLE_DESCRIPTIONS[u.role]}>
                            {(u.role || 'Unassigned').replace(/([a-z])([A-Z])/g, '$1 $2')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => setEditingRoleUserId(editingRoleUserId === u.id ? null : u.id)}
                            disabled={savingUserId === u.id}
                            className={`p-1.5 rounded-lg border shadow-2xs transition-all disabled:opacity-50 ${
                              editingRoleUserId === u.id
                                ? 'border-purple bg-purple/10 text-purple'
                                : 'border-slate-200 bg-white text-slate-500 hover:text-purple hover:bg-purple/5'
                            }`}
                            title="Change role"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setStatusToggleTarget(u)}
                            disabled={savingUserId === u.id}
                            className={`p-1.5 rounded-lg border shadow-2xs bg-white transition-all disabled:opacity-50 ${
                              u.isActive
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={u.isActive ? 'Deactivate user' : 'Activate user'}
                          >
                            {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Roles tab — role cards with descriptions */}
          {usersInnerTab === 'roles' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5">
            <h3 className="font-black text-sm text-navy uppercase tracking-wider flex items-center space-x-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-purple" />
              <span>Role Definitions</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ASSIGNABLE_ROLES.map((r) => (
                <div key={r} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="font-bold text-xs text-purple">{r.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{ROLE_DESCRIPTIONS[r]}</p>
                </div>
              ))}
            </div>
          </div>
          )}
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

      {/* ADD USER MODAL (POST /auth/users) */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-navy uppercase tracking-wider">Add User</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-navy">First Name *</label>
                  <input
                    type="text"
                    value={addUserForm.firstName}
                    onChange={(e) => setAddUserForm({ ...addUserForm, firstName: e.target.value })}
                    placeholder="e.g. Priya"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                  />
                </div>
                <div>
                  <label className="font-bold text-navy">Last Name</label>
                  <input
                    type="text"
                    value={addUserForm.lastName}
                    onChange={(e) => setAddUserForm({ ...addUserForm, lastName: e.target.value })}
                    placeholder="e.g. Raman"
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-navy">Email *</label>
                <input
                  type="email"
                  value={addUserForm.email}
                  onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
                  placeholder="user@aadhicrackers.com"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 outline-none focus:border-purple"
                />
              </div>

              <div>
                <label className="font-bold text-navy">Role *</label>
                <select
                  value={addUserForm.role}
                  onChange={(e) => setAddUserForm({ ...addUserForm, role: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-bold text-navy outline-none"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">{ROLE_DESCRIPTIONS[addUserForm.role]}</p>
              </div>

              <div>
                <label className="font-bold text-navy">Temporary Password *</label>
                <input
                  type="text"
                  value={addUserForm.password}
                  onChange={(e) => setAddUserForm({ ...addUserForm, password: e.target.value })}
                  placeholder="Share securely with the new user"
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 font-mono outline-none focus:border-purple"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setIsAddUserOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={isCreatingUser}
                className="px-5 py-2 rounded-xl bg-purple hover:bg-purple-dark text-white text-xs font-bold shadow-md shadow-purple/20 disabled:opacity-50"
              >
                {isCreatingUser ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROLE CHANGE CONFIRMATION */}
      <ErpConfirmDialog
        open={!!roleChangeTarget}
        title="Change User Role?"
        message={
          roleChangeTarget ? (
            <>
              <span className="font-bold text-navy">
                {roleChangeTarget.user.firstName} {roleChangeTarget.user.lastName}
              </span>{' '}
              will be changed from <strong>{roleChangeTarget.user.role}</strong> to{' '}
              <strong>{roleChangeTarget.newRole}</strong>.
              <span className="block mt-1.5 text-slate-500">
                {ROLE_DESCRIPTIONS[roleChangeTarget.newRole]}
              </span>
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Change Role"
        onConfirm={handleConfirmRoleChange}
        onCancel={() => setRoleChangeTarget(null)}
      />

      {/* STATUS TOGGLE CONFIRMATION */}
      <ErpConfirmDialog
        open={!!statusToggleTarget}
        title={statusToggleTarget?.isActive ? 'Deactivate User?' : 'Activate User?'}
        message={
          statusToggleTarget ? (
            <>
              <span className="font-bold text-navy">
                {statusToggleTarget.firstName} {statusToggleTarget.lastName}
              </span>{' '}
              ({statusToggleTarget.email}) will be{' '}
              {statusToggleTarget.isActive
                ? 'deactivated and can no longer sign in to the admin panel.'
                : 'reactivated and can sign in to the admin panel again.'}
            </>
          ) : (
            ''
          )
        }
        confirmLabel={statusToggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        onConfirm={handleConfirmStatusToggle}
        onCancel={() => setStatusToggleTarget(null)}
      />
    </div>
  );
};
