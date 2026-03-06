import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

import { API_URL } from '../config/api';

interface SampleEntry {
  id: string;
  entryDate: string;
  brokerName: string;
  variety: string;
  partyName: string;
  location: string;
  bags: number;
  packaging?: string;
  workflowStatus: string;
  entryType?: string;
  lorryNumber?: string;
  sampleCollectedBy?: string;
  qualityParameters?: {
    grainsCount?: number;
    reportedBy?: string;
    kandu?: number;
    oil?: number;
    mixKandu?: number;
  };
  cookingReport?: {
    status: string;
    remarks: string;
    cookingDoneBy?: string;
    cookingApprovedBy?: string;
    history?: any[];
  };
}

interface SupervisorUser {
  id: number;
  username: string;
}

const toTitleCase = (str: string) => str ? str.replace(/\b\w/g, c => c.toUpperCase()) : '';

const CookingReport: React.FC = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [entries, setEntries] = useState<SampleEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SampleEntry | null>(null);
  const [cookingData, setCookingData] = useState({
    status: '',
    remarks: '',
    cookingDoneBy: '',
    cookingApprovedBy: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([]);
  const [manualCookingName, setManualCookingName] = useState('');
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [showRemarksInput, setShowRemarksInput] = useState(false);

  // --- HISTORY MODAL STATES ---
  const [historyModal, setHistoryModal] = useState<{ visible: boolean; title: string; content: React.ReactNode }>({ visible: false, title: '', content: null });

  // --- NEW RICE FEATURE STATES ---
  const [activeTab, setActiveTab] = useState<'PADDY_COOKING_REPORT' | 'RICE_COOKING_REPORT'>('PADDY_COOKING_REPORT');

  // Custom states for Admin/Manager 'Cooking Approved by' toggles
  const [approvalType, setApprovalType] = useState<'owner' | 'manager' | 'admin' | 'manual'>('owner');
  const [manualApprovalName, setManualApprovalName] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);

  // Filters
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterBroker, setFilterBroker] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 100;
  const canTakeAction = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'staff';

  useEffect(() => {
    loadEntries();
  }, [page]);

  useEffect(() => {
    loadSupervisors();
  }, []);

  const loadSupervisors = async () => {
    try {
      const token = localStorage.getItem('token');
      // Fetch staff (Paddy Supervisors) instead of physical_supervisor
      const response = await axios.get(`${API_URL}/admin/users`, {
        params: { role: 'staff' },
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data as any;
      const users = Array.isArray(data) ? data : (data.users || []);
      // Client-side filter to ensure only Staff (Paddy Supervisors) are shown in the dropdown,
      // as the backend doesn't filter by the 'role' query param.
      setSupervisors(users.filter((u: any) => u.isActive !== false && u.role === 'staff'));
    } catch (error) {
      console.error('Error loading supervisors:', error);
    }
  };

  const loadEntries = async (fFrom?: string, fTo?: string, fBroker?: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // Always show entries that have finished cooking (or await final approval)
      const params: any = { status: 'COOKING_BOOK', page, pageSize: PAGE_SIZE };

      const dFrom = fFrom !== undefined ? fFrom : filterDateFrom;
      const dTo = fTo !== undefined ? fTo : filterDateTo;
      const b = fBroker !== undefined ? fBroker : filterBroker;

      if (dFrom) params.startDate = dFrom;
      if (dTo) params.endDate = dTo;
      if (b) params.broker = b;
      const response = await axios.get(`${API_URL}/sample-entries/by-role`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data as any;
      setEntries(data.entries || []);
      if (data.total != null) {
        setTotal(data.total);
        setTotalPages(data.totalPages || Math.ceil(data.total / PAGE_SIZE));
      }
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to load entries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(1);
    setTimeout(() => {
      loadEntries();
    }, 0);
  };

  const handleClearFilters = () => {
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterBroker('');
    setPage(1);
    setTimeout(() => {
      loadEntries('', '', '');
    }, 0);
  };

  const handleOpenModal = (entry: SampleEntry) => {
    setSelectedEntry(entry);
    setShowModal(true);

    // If staff is opening the modal, they are submitting a NEW action (either fresh or recheck).
    // Clear the saved name so both the dropdown and manual input are visible by default.
    const savedName = user?.role === 'staff' ? '' : (entry.cookingReport?.cookingDoneBy || '');
    const isDropdownOption = !savedName || supervisors.some(s =>
      s.username.toLowerCase() === savedName.toLowerCase()
    );

    setCookingData({
      status: entry.cookingReport?.status || '',
      remarks: entry.cookingReport?.remarks || '',
      cookingDoneBy: isDropdownOption ? savedName : '',
      cookingApprovedBy: entry.cookingReport?.cookingApprovedBy || ''
    });

    setManualCookingName(isDropdownOption ? '' : savedName);
    setUseManualEntry(!isDropdownOption && !!savedName);
    setShowRemarksInput(!!entry.cookingReport?.remarks);

    // Attempt to match existing approval type
    if (entry.cookingReport?.cookingApprovedBy === 'Harish') setApprovalType('owner');
    else if (entry.cookingReport?.cookingApprovedBy === 'Guru') setApprovalType('manager');
    else if (entry.cookingReport?.cookingApprovedBy === 'MK Subbu') setApprovalType('admin');
    else setApprovalType('owner');

    setManualApprovalName('');
    setManualDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry || isSubmitting) return;

    // Capitalize function
    const capitalize = (str: string) => str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

    // Determine cookingDoneBy value (from form, fallback to existing, or clear if RECHECK)
    let finalCookingDoneBy = capitalize(useManualEntry ? manualCookingName.trim() : cookingData.cookingDoneBy);
    if (!finalCookingDoneBy && selectedEntry.cookingReport?.cookingDoneBy) {
      finalCookingDoneBy = selectedEntry.cookingReport.cookingDoneBy;
    }

    // On RECHECK, preserve the existing cookingDoneBy and cookingApprovedBy names
    // so they remain visible in the cooking report table

    // Determine cookingApprovedBy value (Admin/Manager overrides, staff preserves existing)
    let finalCookingApprovedBy = selectedEntry.cookingReport?.cookingApprovedBy || '';
    if (user?.role !== 'staff') {
      if (approvalType === 'owner') finalCookingApprovedBy = 'Harish';
      else if (approvalType === 'manager') finalCookingApprovedBy = 'Guru';
      else if (approvalType === 'admin') finalCookingApprovedBy = 'MK Subbu';
    }

    const finalRemarks = showRemarksInput ? cookingData.remarks : '';

    // Determine status (Staff cannot set status, and submitting a Recheck should reset it to Pending)
    let finalStatus = cookingData.status;
    if (user?.role === 'staff') {
      finalStatus = ''; // Staff submitting always resets the admin's status decision
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/sample-entries/${selectedEntry.id}/cooking-report`,
        { ...cookingData, status: finalStatus, remarks: finalRemarks, cookingDoneBy: finalCookingDoneBy, cookingApprovedBy: finalCookingApprovedBy, manualDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showNotification('Cooking report added successfully', 'success');

      if (cookingData.status === 'MEDIUM') {
        try {
          await axios.post(
            `${API_URL}/sample-entries/${selectedEntry.id}/transition`,
            { toStatus: 'LOT_SELECTION' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          showNotification('✅ Medium selected - Lot moved to Final Pass Lots!', 'success');
        } catch (transitionErr) {
          console.error('Error transitioning lot:', transitionErr);
        }
      }

      setShowModal(false);
      setSelectedEntry(null);
      loadEntries();
    } catch (error: any) {
      showNotification(error.response?.data?.error || 'Failed to add cooking report', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const brokersList = useMemo(() => {
    const allBrokers = entries.map(e => e.brokerName);
    return Array.from(new Set(allBrokers)).filter(Boolean).sort();
  }, [entries]);

  const groupedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());

    const grouped: Record<string, Record<string, typeof sorted>> = {};
    sorted.forEach(entry => {
      const dateKey = new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const brokerKey = entry.brokerName || 'Unknown';
      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][brokerKey]) grouped[dateKey][brokerKey] = [];
      grouped[dateKey][brokerKey].push(entry);
    });
    return grouped;
  }, [entries]);

  const getStatusBadge = (entry: SampleEntry) => {
    if (!entry.cookingReport) {
      return <span style={{ color: '#e67e22', fontWeight: '700' }}>⏳ Pending</span>;
    }
    const cr = entry.cookingReport;
    const statusMap: Record<string, { color: string; bg: string; label: string }> = {
      PASS: { color: '#27ae60', bg: '#e8f5e9', label: '✓ Pass' },
      FAIL: { color: '#e74c3c', bg: '#fdecea', label: '✕ Fail' },
      RECHECK: { color: '#e67e22', bg: '#fff3e0', label: '↻ Recheck' },
      MEDIUM: { color: '#f39c12', bg: '#ffe0b2', label: '◎ Medium' }
    };

    // Check if the exact last action was staff adding cookingDoneBy
    const history = cr.history || [];
    const lastHistory = history.length > 0 ? history[history.length - 1] : null;
    const isWaitingForAdmin = lastHistory && !lastHistory.status && lastHistory.cookingDoneBy;

    let info = cr.status ? statusMap[cr.status] : null;

    if (isWaitingForAdmin && user?.role === 'staff') {
      info = { color: '#2980b9', bg: '#e3f2fd', label: '⏳ Admin want to approve' };
    } else if (!info) {
      if (cr.cookingDoneBy) {
        info = user?.role === 'staff' ? { color: '#2980b9', bg: '#e3f2fd', label: '⏳ Admin want to approve' } : { color: '#999', bg: '#f5f5f5', label: 'Pending' };
      } else {
        info = { color: '#999', bg: '#f5f5f5', label: 'Pending' };
      }
    }

    const handleBadgeClick = () => {
      if (cr.remarks) {
        setHistoryModal({ visible: true, title: 'Remarks', content: <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{cr.remarks}</div> });
      } else {
        setHistoryModal({ visible: true, title: 'Remarks', content: <div style={{ fontSize: '14px', color: '#666', fontStyle: 'italic' }}>No remarks for this entry.</div> });
      }
    };

    return (
      <span
        onClick={handleBadgeClick}
        style={{
          color: info.color,
          backgroundColor: info.bg,
          fontWeight: '700',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          cursor: 'pointer'
        }}
        title="Click to see remarks"
      >
        {info.label}
      </span>
    );
  };

  const renderCookingDoneByWithDate = (cr: any, fallback: string) => {
    if (!cr?.history || cr.history.length === 0) {
      return <div>{cr?.cookingDoneBy || fallback || '-'}</div>;
    }

    // Only count entries where staff submitted (no status = staff action)
    const cookings = cr.history.filter((h: any) => h.cookingDoneBy && !h.status);
    if (cookings.length === 0) return <div>{cr?.cookingDoneBy || fallback || '-'}</div>;

    const handleClick = () => {
      const histContent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
          {cookings.map((c: any, i: number) => (
            <div key={i} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
              <div style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>{i + 1}. {c.cookingDoneBy}</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{new Date(c.date).toLocaleString('en-GB')}</div>
            </div>
          ))}
        </div>
      );
      setHistoryModal({ visible: true, title: 'Cooking History', content: histContent });
    };

    const latestIndex = cookings.length - 1;
    const latest = cookings[latestIndex];

    return (
      <div onClick={handleClick} style={{ cursor: 'pointer' }} title="Click to view history">
        <div style={{ fontWeight: '600', color: '#6a1b9a' }}>{latestIndex + 1}. {latest.cookingDoneBy}</div>
        {latest.date && (
          <div style={{ fontSize: '10px', color: '#666', marginTop: '1px', fontWeight: 'normal' }}>
            {new Date(latest.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        )}
      </div>
    );
  };

  const renderApprovedByWithDate = (cr: any) => {
    if (!cr?.history || cr.history.length === 0) {
      return cr?.cookingApprovedBy ? <div>{cr.cookingApprovedBy}</div> : '-';
    }

    // Only count entries where admin submitted (has status = admin action)
    const approvals = cr.history.filter((h: any) => h.approvedBy && h.status);
    if (approvals.length === 0) return '-';

    const handleClick = () => {
      const histContent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
          {approvals.map((a: any, i: number) => (
            <div key={i} style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>{i + 1}. {a.approvedBy}</span>
                <span style={{ fontWeight: '700', fontSize: '12px', padding: '2px 6px', borderRadius: '4px', backgroundColor: a.status === 'PASS' ? '#e8f5e9' : a.status === 'FAIL' ? '#fdecea' : a.status === 'RECHECK' ? '#fff3e0' : '#ffe0b2', color: a.status === 'PASS' ? '#27ae60' : a.status === 'FAIL' ? '#e74c3c' : a.status === 'RECHECK' ? '#e67e22' : '#f39c12' }}>
                  {a.status || 'No Status'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{new Date(a.date).toLocaleString('en-GB')}</div>
            </div>
          ))}
        </div>
      );
      setHistoryModal({ visible: true, title: 'Approval History', content: histContent });
    };

    const latestIndex = approvals.length - 1;
    const latest = approvals[latestIndex];

    const statusColors: Record<string, { color: string; bg: string }> = {
      PASS: { color: '#27ae60', bg: '#e8f5e9' },
      FAIL: { color: '#e74c3c', bg: '#fdecea' },
      RECHECK: { color: '#e67e22', bg: '#fff3e0' },
      MEDIUM: { color: '#f39c12', bg: '#ffe0b2' }
    };
    const sc = latest.status ? statusColors[latest.status] : null;

    return (
      <div onClick={handleClick} style={{ cursor: 'pointer' }} title="Click to view history">
        <div style={{ fontWeight: '600', color: '#1565c0' }}>{latestIndex + 1}. {latest.approvedBy}</div>
        {sc && (
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '3px', backgroundColor: sc.bg, color: sc.color }}>
            {latest.status}
          </span>
        )}
        {latest.date && (
          <div style={{ fontSize: '10px', color: '#666', marginTop: '1px', fontWeight: 'normal' }}>
            {new Date(latest.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        )}
      </div>
    );
  };

  // Filter entries to display
  // We want to display all fetched entries since we need both pending and completed ones
  const displayEntries = useMemo(() => {
    return entries;
  }, [entries]);

  const displayGrouped = useMemo(() => {
    const sorted = [...displayEntries].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
    const grouped: Record<string, Record<string, typeof sorted>> = {};
    sorted.forEach(entry => {
      const dateKey = new Date(entry.entryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const brokerKey = entry.brokerName || 'Unknown';
      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][brokerKey]) grouped[dateKey][brokerKey] = [];
      grouped[dateKey][brokerKey].push(entry);
    });
    return grouped;
  }, [displayEntries]);

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('PADDY_COOKING_REPORT')}
          style={{
            padding: '8px 20px', fontSize: '13px', fontWeight: '700', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
            backgroundColor: activeTab === 'PADDY_COOKING_REPORT' ? '#1a237e' : '#e0e0e0',
            color: activeTab === 'PADDY_COOKING_REPORT' ? 'white' : '#555',
            boxShadow: activeTab === 'PADDY_COOKING_REPORT' ? '0 -2px 5px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          📖 Paddy Cooking Sample
        </button>
        <button
          onClick={() => setActiveTab('RICE_COOKING_REPORT')}
          style={{
            padding: '8px 20px', fontSize: '13px', fontWeight: '700', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer', whiteSpace: 'nowrap',
            backgroundColor: activeTab === 'RICE_COOKING_REPORT' ? '#d35400' : '#e0e0e0',
            color: activeTab === 'RICE_COOKING_REPORT' ? 'white' : '#555',
            boxShadow: activeTab === 'RICE_COOKING_REPORT' ? '0 -2px 5px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          🍚 Rice Cooking Sample
        </button>
      </div>

      {activeTab === 'PADDY_COOKING_REPORT' && (
        <>
          {/* Collapsible Filter Bar */}
          <div style={{ marginBottom: '0px' }}>
            <button
              onClick={() => setFiltersVisible(!filtersVisible)}
              style={{
                padding: '7px 16px',
                backgroundColor: filtersVisible ? '#e74c3c' : '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {filtersVisible ? '✕ Hide Filters' : '🔍 Filters'}
            </button>
            {filtersVisible && (
              <div style={{
                display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'flex-end', flexWrap: 'wrap',
                backgroundColor: '#fff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e0e0e0'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>From Date</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '4px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>To Date</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '4px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#555', marginBottom: '3px' }}>Broker</label>
                  <select value={filterBroker} onChange={e => setFilterBroker(e.target.value)}
                    style={{ padding: '5px 8px', borderRadius: '4px', fontSize: '12px', minWidth: '140px', backgroundColor: 'white' }}>
                    <option value="">All Brokers</option>
                    {brokersList.map((b, i) => <option key={i} value={b}>{b}</option>)}
                  </select>
                </div>
                {(filterDateFrom || filterDateTo || filterBroker) && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleApplyFilters}
                      style={{ padding: '5px 12px', border: 'none', borderRadius: '4px', backgroundColor: '#3498db', color: 'white', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                      Apply Filters
                    </button>
                    <button onClick={handleClearFilters}
                      style={{ padding: '5px 12px', border: '1px solid #e74c3c', borderRadius: '4px', backgroundColor: '#fff', color: '#e74c3c', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto', backgroundColor: 'white' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
            ) : Object.keys(displayGrouped).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No cooking reports found</div>
            ) : (
              Object.entries(displayGrouped).map(([dateKey, brokerGroups]) => {
                let brokerSeq = 0;
                return (
                  <div key={dateKey} style={{ marginBottom: '20px' }}>
                    {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                      brokerSeq++;
                      let slNo = 0;
                      return (
                        <div key={brokerName} style={{ marginBottom: '0px' }}>
                          {/* Date bar — only first broker */}
                          {brokerIdx === 0 && <div style={{
                            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                            color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                            textAlign: 'center', letterSpacing: '0.5px'
                          }}>
                            {(() => { const d = new Date(brokerEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                            &nbsp;&nbsp;Paddy Sample Cooking
                          </div>}
                          {/* Broker name bar */}
                          <div style={{
                            background: '#e8eaf6',
                            color: '#000', padding: '4px 10px', fontWeight: '700', fontSize: '13.5px',
                            display: 'flex', alignItems: 'center', gap: '4px'
                          }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '800' }}>{brokerSeq}.</span> {brokerName}
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', border: '1px solid #000' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '3%' }}>SL No</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '3%' }}>Type</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '4%' }}>Bags</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '3%' }}>Pkg</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '14%' }}>Party Name</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '10%' }}>Paddy Location</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '8%' }}>Variety</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '6%' }}>Quality</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '6%' }}>Sample Report By</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '5%' }}>Grain</th>
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Cooking Done by</th>

                                {user?.role !== 'staff' && (
                                  <>
                                    <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Cooking Apprvd By</th>
                                  </>
                                )}
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Status</th>

                                {canTakeAction && (
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Action</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {brokerEntries.map((entry) => {
                                slNo++;

                                // Determine Quality Info (Pass)
                                let objQuality: React.ReactNode = '-';
                                if (entry.qualityParameters) {
                                  objQuality = <span style={{ color: '#2e7d32' }}>Pass</span>;
                                }

                                return (
                                  <tr key={entry.id} style={{ backgroundColor: entry.entryType === 'DIRECT_LOADED_VEHICLE' ? '#e3f2fd' : entry.entryType === 'LOCATION_SAMPLE' ? '#ffe0b2' : '#ffffff', }}>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{slNo}</td>
                                    <td style={{ border: '1px solid #000', padding: '1px 3px', textAlign: 'center', verticalAlign: 'middle' }}>
                                      {entry.entryType === 'DIRECT_LOADED_VEHICLE' && <span style={{ color: 'white', backgroundColor: '#1565c0', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontWeight: '800' }}>RL</span>}
                                      {entry.entryType === 'LOCATION_SAMPLE' && <span style={{ color: 'white', backgroundColor: '#e67e22', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontWeight: '800' }}>LS</span>}
                                      {entry.entryType !== 'DIRECT_LOADED_VEHICLE' && entry.entryType !== 'LOCATION_SAMPLE' && <span style={{ color: '#333', backgroundColor: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '12px', fontWeight: '800', border: '1px solid #ccc' }}>MS</span>}
                                    </td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{entry.bags?.toLocaleString('en-IN') || '0'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '13px', textAlign: 'center' }}>{entry.packaging || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#1565c0' }}>{toTitleCase(entry.partyName)}{entry.entryType === 'DIRECT_LOADED_VEHICLE' && entry.lorryNumber ? <div style={{ fontSize: '13px', color: '#1565c0', fontWeight: '600' }}>{entry.lorryNumber.toUpperCase()}</div> : ''}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.location) || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.variety)}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '700' }}>{objQuality}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600' }}>{entry.qualityParameters?.reportedBy || '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '13px', fontWeight: '700', color: '#333' }}>{entry.qualityParameters?.grainsCount ? `(${entry.qualityParameters.grainsCount})` : '-'}</td>
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6a1b9a' }}>
                                      {renderCookingDoneByWithDate(entry.cookingReport, '')}
                                    </td>

                                    {user?.role !== 'staff' && (
                                      <>
                                        <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#1565c0' }}>
                                          {renderApprovedByWithDate(entry.cookingReport)}
                                        </td>
                                      </>
                                    )}
                                    <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px' }}>
                                      {getStatusBadge(entry)}
                                    </td>
                                    {canTakeAction && (
                                      <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                                        {(() => {
                                          const cr = entry.cookingReport;
                                          const h = cr?.history || [];
                                          const lastH = h.length > 0 ? h[h.length - 1] : null;
                                          const waitingAdmin = lastH && !lastH.status && lastH.cookingDoneBy;
                                          const waitingStaff = !cr || (cr.status === 'RECHECK' && !waitingAdmin) || (!cr.cookingDoneBy && !waitingAdmin);

                                          if (user?.role !== 'staff' || waitingStaff) {
                                            return (
                                              <button
                                                onClick={() => handleOpenModal(entry)}
                                                style={{
                                                  fontSize: '9px', padding: '4px 10px',
                                                  backgroundColor: '#3498db', color: 'white', border: 'none',
                                                  borderRadius: '10px', cursor: 'pointer', fontWeight: '600'
                                                }}
                                              >
                                                {user?.role === 'staff' ? 'Add Cooking Done By' : 'Add Report'}
                                              </button>
                                            );
                                          } else {
                                            return <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>Locked</span>;
                                          }
                                        })()}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'RICE_COOKING_REPORT' && (
        <div style={{ overflowX: 'auto', backgroundColor: 'white' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
          ) : Object.keys(displayGrouped).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>No rice samples found</div>
          ) : (
            Object.entries(displayGrouped).map(([dateKey, brokerGroups]) => {
              let brokerSeq = 0;
              // Check if this date has ANY rice entries before rendering the date block
              const hasRiceForDate = Object.values(brokerGroups).some(entries =>
                entries.some(e => e.entryType === 'RICE_SAMPLE')
              );

              if (!hasRiceForDate) return null;

              return (
                <div key={dateKey} style={{ marginBottom: '20px' }}>
                  {Object.entries(brokerGroups).sort(([a], [b]) => a.localeCompare(b)).map(([brokerName, brokerEntries], brokerIdx) => {
                    const riceEntries = brokerEntries.filter(e => e.entryType === 'RICE_SAMPLE');
                    if (riceEntries.length === 0) return null;

                    brokerSeq++;
                    let slNo = 0;
                    return (
                      <div key={brokerName} style={{ marginBottom: '0px' }}>
                        {/* Date bar */}
                        {brokerIdx === 0 && <div style={{
                          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                          color: 'white', padding: '6px 10px', fontWeight: '700', fontSize: '14px',
                          textAlign: 'center', letterSpacing: '0.5px'
                        }}>
                          {(() => { const d = new Date(riceEntries[0]?.entryDate); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; })()}
                          &nbsp;&nbsp;Rice Sample Cooking
                        </div>}

                        {/* Broker name bar */}
                        <div style={{
                          background: '#e8eaf6',
                          color: '#000', padding: '4px 10px', fontWeight: '700', fontSize: '13.5px',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '800' }}>{brokerSeq}.</span> {brokerName}
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', border: '1px solid #000' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '3%' }}>SL No</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Qnty / Bags</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '16%' }}>Party Name</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '12%' }}>Location</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'left', width: '10%' }}>Variety</th>
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '10%' }}>Cooking Done by</th>

                              {user?.role !== 'staff' && (
                                <>
                                  <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '10%' }}>Cooking Apprvd By</th>
                                </>
                              )}
                              <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '8%' }}>Status</th>

                              {canTakeAction && (
                                <th style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: '600', fontSize: '13px', textAlign: 'center', width: '9%' }}>Action</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {riceEntries.map((entry) => {
                              slNo++;
                              return (
                                <tr key={entry.id}>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '600', fontSize: '13px' }}>{slNo}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontWeight: '700', fontSize: '13px', color: '#1565c0' }}>
                                    {entry.bags?.toLocaleString('en-IN') || '0'}
                                    {entry.packaging === 'Tons' ? ' Tons' : `/${entry.packaging || '-'}`}
                                  </td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: '#1565c0' }}>{toTitleCase(entry.partyName)}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.location) || '-'}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontSize: '13px' }}>{toTitleCase(entry.variety)}</td>
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6a1b9a' }}>
                                    {renderCookingDoneByWithDate(entry.cookingReport, '')}
                                  </td>

                                  {user?.role !== 'staff' && (
                                    <>
                                      <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#1565c0' }}>
                                        {renderApprovedByWithDate(entry.cookingReport)}
                                      </td>
                                    </>
                                  )}
                                  <td style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'center', fontSize: '12px' }}>
                                    {getStatusBadge(entry)}
                                  </td>
                                  {canTakeAction && (
                                    <td style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'center' }}>
                                      {(() => {
                                        const cr = entry.cookingReport;
                                        const h = cr?.history || [];
                                        const lastH = h.length > 0 ? h[h.length - 1] : null;
                                        const waitingAdmin = lastH && !lastH.status && lastH.cookingDoneBy;
                                        const waitingStaff = !cr || (cr.status === 'RECHECK' && !waitingAdmin) || (!cr.cookingDoneBy && !waitingAdmin);

                                        if (user?.role !== 'staff' || waitingStaff) {
                                          return (
                                            <button
                                              onClick={() => handleOpenModal(entry)}
                                              style={{
                                                fontSize: '9px', padding: '4px 10px',
                                                backgroundColor: '#3498db', color: 'white', border: 'none',
                                                borderRadius: '10px', cursor: 'pointer', fontWeight: '600'
                                              }}
                                            >
                                              {user?.role === 'staff' ? 'Add Cooking Done By' : 'Add Report'}
                                            </button>
                                          );
                                        } else {
                                          return <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>Locked</span>;
                                        }
                                      })()}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Cooking Report Modal */}
      {showModal && selectedEntry && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '500px',
            border: '1px solid #999', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '16px 20px', color: 'white'
            }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {user?.role === 'staff' ? '🍳 Add Preparing for Cooking' : `🍳 Add ${selectedEntry.entryType === 'RICE_SAMPLE' ? 'Rice' : 'Paddy'} Cooking Report`}
              </h3>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.4', opacity: 0.95, fontWeight: '500' }}>
                <span style={{ fontWeight: '800' }}>Broker Name:</span> {selectedEntry.brokerName}<br />
                <span style={{ fontWeight: '800' }}>Party Name:</span> {toTitleCase(selectedEntry.partyName)}<br />
                <span style={{ fontWeight: '800' }}>Variety:</span> {selectedEntry.variety}<br />
                <span style={{ fontWeight: '800' }}>Bags:</span> {selectedEntry.bags?.toLocaleString('en-IN')}
              </p>
            </div>

            <div style={{ padding: '20px' }}>

              {(user?.role !== 'staff' && !selectedEntry.cookingReport?.cookingDoneBy) ? (
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px', color: '#856404' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>⚠️ Action Required by Paddy Supervisor</p>
                  <p style={{ margin: '8px 0 0', fontSize: '13px' }}>The Paddy Supervisor must select "Cooking Done By" and save their details before an Admin or Manager can approve and set the Status.</p>
                  <div style={{ marginTop: '16px' }}>
                    <button type="button" onClick={() => setShowModal(false)}
                      style={{ padding: '8px 16px', cursor: 'pointer', border: '1px solid #999', borderRadius: '3px', backgroundColor: 'white', fontSize: '13px', color: '#666' }}>
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  {/* Status & Date - Hidden for staff */}
                  {user?.role !== 'staff' && (
                    <>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontWeight: '600', color: '#555', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                          Date
                        </label>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => setManualDate(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px' }}
                          max={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontWeight: '600', color: '#555', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
                          Status *
                        </label>
                        <select
                          value={cookingData.status}
                          onChange={(e) => setCookingData({ ...cookingData, status: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px' }}
                          required
                        >
                          <option value="">-- Select Status --</option>
                          <option value="PASS">Pass</option>
                          <option value="FAIL">Fail</option>
                          <option value="RECHECK">Recheck</option>
                          <option value="MEDIUM">Medium</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* Cooking Done By - STRICTLY FOR STAFF */}
                  {user?.role === 'staff' && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500', color: '#555', fontSize: '13px' }}>
                        Cooking Done by*
                      </label>
                      {!useManualEntry && (
                        <select
                          value={cookingData.cookingDoneBy}
                          onChange={(e) => {
                            setCookingData({ ...cookingData, cookingDoneBy: e.target.value });
                          }}
                          style={{
                            width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px',
                            backgroundColor: 'white', marginBottom: '6px'
                          }}
                        >
                          <option value="">-- Select from list --</option>
                          {supervisors.map(s => (
                            <option key={s.id} value={s.username}>{toTitleCase(s.username)}</option>
                          ))}
                        </select>
                      )}

                      {(!cookingData.cookingDoneBy) && (
                        <input
                          type="text"
                          placeholder="Or Type Name Manually"
                          value={manualCookingName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualCookingName(val);
                            setUseManualEntry(val.trim() !== '');
                          }}
                          style={{
                            width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px',
                            backgroundColor: 'white'
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Admin and Manager Block - Cooking Approved By & Remarks */}
                  {user?.role !== 'staff' && (
                    <>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#555', fontSize: '13px' }}>
                          Cooking Approved by*
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', marginBottom: '8px', fontSize: '13px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="approvalType"
                              checked={approvalType === 'owner'}
                              onChange={() => setApprovalType('owner')}
                            />
                            Harish
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="approvalType"
                              checked={approvalType === 'manager'}
                              onChange={() => setApprovalType('manager')}
                            />
                            Guru
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="approvalType"
                              checked={approvalType === 'admin'}
                              onChange={() => setApprovalType('admin')}
                            />
                            MK Subbu
                          </label>
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '500', color: '#555' }}>Remarks</span>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '4px', fontSize: '13px' }}>
                            <input
                              type="radio"
                              checked={!showRemarksInput}
                              onChange={() => setShowRemarksInput(false)}
                            /> No
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '4px', fontSize: '13px' }}>
                            <input
                              type="radio"
                              checked={showRemarksInput}
                              onChange={() => setShowRemarksInput(true)}
                            /> Yes
                          </label>
                        </div>

                        {showRemarksInput && (
                          <textarea
                            value={cookingData.remarks}
                            onChange={(e) => setCookingData({ ...cookingData, remarks: e.target.value })}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #999', borderRadius: '3px', fontSize: '13px', minHeight: '60px' }}
                            placeholder="Enter remarks..."
                          />
                        )}
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                    <button type="button" onClick={() => setShowModal(false)} disabled={isSubmitting}
                      style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', border: '1px solid #999', borderRadius: '3px', backgroundColor: 'white', fontSize: '13px', color: '#666' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting}
                      style={{ padding: '8px 16px', cursor: isSubmitting ? 'not-allowed' : 'pointer', backgroundColor: isSubmitting ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '3px', fontSize: '13px', fontWeight: '600' }}>
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal.visible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1100, padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', width: '100%', maxWidth: '400px',
            border: '1px solid #999', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden'
          }}>
            <div style={{
              background: '#f8f9fa', padding: '12px 16px', borderBottom: '1px solid #e0e0e0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#333' }}>
                {historyModal.title}
              </h3>
              <button
                onClick={() => setHistoryModal({ visible: false, title: '', content: null })}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#999' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px', maxHeight: '60vh', overflowY: 'auto' }}>
              {historyModal.content}
            </div>
            <div style={{ padding: '12px 16px', background: '#f8f9fa', borderTop: '1px solid #e0e0e0', textAlign: 'right' }}>
              <button
                onClick={() => setHistoryModal({ visible: false, title: '', content: null })}
                style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '16px 0', marginTop: '12px' }}>
        <button
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page <= 1 ? '#eee' : '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          ← Prev
        </button>
        <span style={{ fontSize: '13px', color: '#666' }}>
          Page {page} of {totalPages} &nbsp;({total} total)
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          style={{ padding: '6px 16px', borderRadius: '4px', border: '1px solid #ccc', background: page >= totalPages ? '#eee' : '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontWeight: '600' }}
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default CookingReport;
