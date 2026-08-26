import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import './Nav.css';

export default function Nav() {
  const { isLoggedIn, username, logout } = useAuth();
  const { openModal } = useOnboarding();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="site-nav" aria-label="Site navigation">
      <Link to="/" className="site-title">NextPlay</Link>
      <div className="nav-actions">
        <Link to="/">Value Rankings</Link>
        {isLoggedIn && <Link to="/my-games">My Games</Link>}
        <button className="nav-setup" onClick={openModal}>My Setup</button>
        {isLoggedIn ? (
          <>
            <span className="nav-username">{username}</span>
            <button className="nav-logout" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup" className="nav-signup">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
