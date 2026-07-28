import React from 'react';
import { User } from '../../lib/types';
import { api } from '../../lib/api';
import { LogOut } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
  const { error, success } = useToast();

  const handleLogout = async () => {
    try {
      await api.logout();
      success('Logged out successfully');
      onLogout();
    } catch (e: any) {
      error(e.message || 'Logout failed');
    }
  };

  return (
    <div className="user-menu">
      {user.picture ? (
        <img src={user.picture} alt={user.name} className="user-avatar" />
      ) : (
        <div className="user-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', background: 'var(--primary-gradient)', color: '#fff' }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="user-info">
        <span className="user-name">{user.name}</span>
        <span className="user-email">{user.email}</span>
      </div>
      <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.4rem 0.8rem', display: 'flex', gap: '0.25rem', fontSize: '0.85rem' }}>
        <LogOut size={14} />
        Logout
      </button>
    </div>
  );
};
