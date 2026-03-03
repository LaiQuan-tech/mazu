import React, { useState, useEffect } from 'react';
import { getBookings, updateBookingStatus } from '../services/supabase';
import { BookingRecord, BookingStatus } from '../types';
import { 
  ArrowLeft, 
  RefreshCw, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  FileText,
  CheckCircle,
  XCircle,
  Clock3
} from 'lucide-react';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBookings();
      setBookings(data);
    } catch (err) {
      setError('無法載入預約資料，請稍後再試。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleStatusChange = async (id: string, newStatus: BookingStatus) => {
    setUpdatingId(id);
    try {
      await updateBookingStatus(id, newStatus);
      setBookings(prev => 
        prev.map(b => b.id === id ? { ...b, status: newStatus } : b)
      );
    } catch (err) {
      alert('更新狀態失敗');
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadge = (status?: BookingStatus) => {
    switch (status) {
      case BookingStatus.PENDING:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock3 className="w-3 h-3"/> {status}</span>;
      case BookingStatus.CONFIRMED:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {status}</span>;
      case BookingStatus.COMPLETED:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {status}</span>;
      case BookingStatus.CANCELLED:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1"><XCircle className="w-3 h-3"/> {status}</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status || '未知'}</span>;
    }
  };

  const formatDate = (dateString: any) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('zh-TW', { 
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(date);
    } catch (e) {
      return String(dateString);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <button 
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-temple-red transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> 返回前台
            </button>
            <h1 className="text-3xl font-bold text-gray-900 font-serif">預約管理後台</h1>
          </div>
          
          <button 
            onClick={fetchBookings}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-temple-red disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        </div>

        {/* Content */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
          {loading && bookings.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-temple-red" />
              <p>載入預約資料中...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">
              <p>{error}</p>
              <button 
                onClick={fetchBookings}
                className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                重試
              </button>
            </div>
          ) : bookings.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">目前沒有任何預約紀錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      信眾資訊
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      預約時間 / 項目
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      備註
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      狀態
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-temple-red/10 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-temple-red" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{booking.name}</div>
                            <div className="text-sm text-gray-500 flex items-center mt-1">
                              <Phone className="w-3 h-3 mr-1" /> {booking.phone}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              生日: {booking.birthDate}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center mb-1">
                          <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                          {booking.bookingDate}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center mb-2">
                          <Clock className="w-4 h-4 mr-2 text-gray-400" />
                          {booking.bookingTime === 'morning' ? '上午 (09:00-12:00)' : 
                           booking.bookingTime === 'afternoon' ? '下午 (14:00-17:00)' : 
                           booking.bookingTime === 'evening' ? '晚上 (19:00-21:00)' : booking.bookingTime}
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {booking.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate" title={booking.notes}>
                          {booking.notes || <span className="text-gray-400 italic">無備註</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                          建立於: {formatDate(booking.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <select
                          value={booking.status || BookingStatus.PENDING}
                          onChange={(e) => handleStatusChange(booking.id, e.target.value as BookingStatus)}
                          disabled={updatingId === booking.id}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-temple-red focus:border-temple-red sm:text-sm rounded-md disabled:opacity-50"
                        >
                          {Object.values(BookingStatus).map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
