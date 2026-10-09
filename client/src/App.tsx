import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Paper,
  Stack, TextField, Toolbar, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import {
  AccountTreeRounded, AssessmentRounded, AssignmentRounded, BusinessRounded,
  AddRounded, ChevronLeftRounded, DashboardRounded, GroupRounded, LogoutRounded, MenuRounded,
  MoreHorizRounded, NotificationsNoneRounded, SearchRounded, SettingsRounded, TimelineRounded, TrendingUpRounded,
} from '@mui/icons-material';
import { login, logout, restoreSession } from './api';
import type { DashboardLayout, Session } from './types';

const drawerWidth = 264;
const navLabels: Record<string, string> = {
  dashboard: 'Genel Bakış', tasks: 'Tüm İşler', board: 'İş Panosu', customers: 'Müşteriler',
  team: 'Ekip', reports: 'Raporlar', finance: 'Finans', settings: 'Ayarlar',
  'my-tasks': 'İşlerim', timesheet: 'Zaman Çizelgesi', 'my-requests': 'Taleplerim', approvals: 'Onaylar',
};
const navIcons: Record<string, React.ReactNode> = {
  dashboard: <DashboardRounded />, tasks: <AssignmentRounded />, board: <AccountTreeRounded />,
  customers: <BusinessRounded />, team: <GroupRounded />, reports: <AssessmentRounded />,
  finance: <TrendingUpRounded />, settings: <SettingsRounded />, 'my-tasks': <AssignmentRounded />,
  timesheet: <TimelineRounded />, 'my-requests': <MoreHorizRounded />, approvals: <AssessmentRounded />,
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession().then(setSession).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (!session) return <LoginScreen onLogin={setSession} />;
  return <Dashboard session={session} onLogout={() => logout().then(() => setSession(null))} />;
}

function LoadingScreen() {
  return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f4f7f8' }}><CircularProgress /></Box>;
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { onLogin(await login(email, password)); }
    catch (requestError: any) { setError(requestError.response?.data?.error?.message ?? 'Giriş yapılamadı. Bilgilerinizi kontrol edin.'); }
    finally { setBusy(false); }
  }

  return <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { md: '1.1fr 0.9fr' }, bgcolor: '#f4f7f8' }}>
    <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: 8, color: 'white', bgcolor: '#10384b', backgroundImage: 'radial-gradient(circle at 15% 20%, rgba(94,180,197,.38), transparent 28%), linear-gradient(145deg, #10384b, #126782)' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-.03em' }}>NORTHSTAR<span style={{ color: '#ed8355' }}>.</span></Typography>
      <Box><Typography variant="h1" sx={{ maxWidth: 560, fontSize: { md: 54, lg: 68 }, lineHeight: 1.02, mb: 3 }}>İşi akışa, ekibi ivmeye dönüştür.</Typography><Typography sx={{ maxWidth: 430, color: 'rgba(255,255,255,.72)', fontSize: 18 }}>Ajansınızın müşterilerini, görevlerini ve kapasitesini tek bir çalışma alanından yönetin.</Typography></Box>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.55)' }}>AGENCY OPERATIONS PLATFORM · 2026</Typography>
    </Box>
    <Box sx={{ display: 'grid', placeItems: 'center', p: { xs: 3, sm: 6 } }}><Card sx={{ width: '100%', maxWidth: 440 }}><CardContent sx={{ p: { xs: 3, sm: 5 } }}>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '.16em' }}>Çalışma alanına giriş</Typography>
      <Typography variant="h3" sx={{ mt: 1, mb: 1 }}>Tekrar hoş geldiniz</Typography><Typography color="text.secondary" sx={{ mb: 4 }}>Ajans panelinize devam etmek için giriş yapın.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={submit}><Stack spacing={2.2}><TextField label="E-posta" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /><TextField label="Şifre" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /><Button type="submit" variant="contained" size="large" disabled={busy} sx={{ py: 1.5, mt: 1 }}>{busy ? <CircularProgress size={22} color="inherit" /> : 'Panele giriş yap'}</Button></Stack></Box>
    </CardContent></Card></Box>
  </Box>;
}

function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const compact = useMediaQuery('(max-width:900px)');
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = <SidebarContent session={session} onLogout={onLogout} onNavigate={() => setMobileOpen(false)} />;
  return <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f7f8fa' }}>
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>{compact ? <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ '& .MuiDrawer-paper': { width: drawerWidth } }}>{nav}</Drawer> : <Drawer variant="permanent" open sx={{ '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', border: 0, borderRight: '1px solid #e0eaed' } }}>{nav}</Drawer>}</Box>
    <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}><Toolbar sx={{ gap: 1.5, borderBottom: '1px solid #e4e8eb', bgcolor: '#fff', minHeight: 68 }}><IconButton onClick={() => setMobileOpen(true)} sx={{ display: { md: 'none' } }}><MenuRounded /></IconButton><TextField placeholder="Her şeyi ara..." InputProps={{ startAdornment: <SearchRounded sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }} sx={{ width: { xs: 190, sm: 300 }, '& .MuiOutlinedInput-root': { bgcolor: '#f6f8f9', borderRadius: 2, '& fieldset': { borderColor: '#e7ebee' } } }} /><Box sx={{ flexGrow: 1 }} /><Button variant="contained" startIcon={<AddRounded />} sx={{ display: { xs: 'none', sm: 'inline-flex' }, bgcolor: '#087f3f', '&:hover': { bgcolor: '#006b34' } }}>Yeni iş</Button><Tooltip title="Bildirimler"><IconButton><NotificationsNoneRounded /></IconButton></Tooltip><Avatar sx={{ bgcolor: '#d9f3e5', color: 'primary.dark', width: 34, height: 34, fontSize: 13, fontWeight: 800 }}>{session.user.firstName[0]}{session.user.lastName[0]}</Avatar></Toolbar><Box sx={{ p: { xs: 2, sm: 4, lg: 5 }, maxWidth: 1480, mx: 'auto' }}><DashboardHome session={session} /></Box></Box>
  </Box>;
}

function SidebarContent({ session, onLogout, onNavigate }: { session: Session; onLogout: () => void; onNavigate: () => void }) {
  const { user, dashboard } = session;
  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}><Box sx={{ p: 3 }}><Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-.04em', color: 'primary.dark' }}>NORTHSTAR<span style={{ color: '#ed8355' }}>.</span></Typography><Typography variant="caption" color="text.secondary">Ajans operasyon merkezi</Typography></Box><Divider /><Box sx={{ p: 2.5, pb: 1 }}><Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>{user.role === 'ADMIN' ? user.adminType?.replaceAll('_', ' ') : user.role}</Typography><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{dashboard.title}</Typography></Box><List sx={{ px: 1.5, flexGrow: 1 }}>{dashboard.nav.map((item) => <ListItemButton key={item} selected={item === 'dashboard'} onClick={onNavigate} sx={{ borderRadius: 2, mb: .5, '&.Mui-selected': { bgcolor: 'rgba(18,103,130,.1)', color: 'primary.main', '& .MuiListItemIcon-root': { color: 'primary.main' } } }}><ListItemIcon sx={{ minWidth: 38 }}>{navIcons[item]}</ListItemIcon><ListItemText primary={navLabels[item] ?? item} /></ListItemButton>)}</List><Box sx={{ p: 2 }}><Divider sx={{ mb: 2 }} /><Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.5 }}><Avatar sx={{ bgcolor: 'primary.light', width: 36, height: 36 }}>{user.firstName[0]}{user.lastName[0]}</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="body2" fontWeight={700} noWrap>{user.fullName}</Typography><Typography variant="caption" color="text.secondary" noWrap>{user.employeeProfile?.jobTitle?.name ?? user.customerContact?.position ?? 'Panel kullanıcısı'}</Typography></Box></Stack><Button fullWidth startIcon={<LogoutRounded />} onClick={onLogout} sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}>Çıkış yap</Button></Box></Box>;
}

function DashboardHome({ session }: { session: Session }) {
  const { user, dashboard } = session;
  const isCustomer = user.role === 'CUSTOMER';
  return <Stack spacing={4}><Box><Typography variant="overline" color="secondary.main" sx={{ fontWeight: 800, letterSpacing: '.14em' }}>{isCustomer ? 'MÜŞTERİ ALANI' : 'BUGÜNÜN ODAĞI'}</Typography><Typography variant="h2" sx={{ mt: .5, fontSize: { xs: 32, md: 44 } }}>{dashboard.title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{dashboard.subtitle}</Typography></Box><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }, gap: 2 }}><Metric label={isCustomer ? 'Açık işler' : 'Aktif işler'} value={isCustomer ? '12' : '48'} detail={isCustomer ? '3 onay bekliyor' : '8 bugün teslim'} tone="blue" /><Metric label="Bu hafta" value="86%" detail="Planlanan kapasite" tone="orange" /><Metric label={isCustomer ? 'İlerleme' : 'Ekip kullanımı'} value="72%" detail="Geçen haftaya göre +8%" tone="green" /><Metric label="Geciken" value="04" detail="Aksiyon gerektiriyor" tone="red" /></Box><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.35fr .65fr' }, gap: 2 }}><Card><CardContent sx={{ p: 3 }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}><Box><Typography variant="h6">İş akışı görünümü</Typography><Typography variant="body2" color="text.secondary">Son 7 günün tamamlanma ritmi</Typography></Box><Chip label="Bu hafta" size="small" variant="outlined" /></Stack><Box sx={{ height: 180, display: 'flex', alignItems: 'end', gap: { xs: 1, sm: 2 }, px: 1 }}>{[48, 72, 58, 86, 66, 94, 78].map((height, index) => <Box key={height} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}><Box sx={{ width: '100%', maxWidth: 52, height: `${height}%`, bgcolor: index === 5 ? 'primary.main' : 'rgba(18,103,130,.14)', borderRadius: '6px 6px 2px 2px' }} /><Typography variant="caption" color="text.secondary">{['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][index]}</Typography></Box>)}</Box></CardContent></Card><Card><CardContent sx={{ p: 3 }}><Typography variant="h6" mb={.5}>Hızlı bakış</Typography><Typography variant="body2" color="text.secondary" mb={3}>Panel kapsamınız</Typography><Stack spacing={2}>{dashboard.widgets.slice(0, 4).map((widget, index) => <Stack direction="row" justifyContent="space-between" key={widget}><Typography variant="body2">{widget.replaceAll('-', ' ')}</Typography><Typography variant="body2" fontWeight={700} color={index === 2 ? 'secondary.main' : 'primary.main'}>{[18, 7, 4, 92][index]}</Typography></Stack>)}</Stack></CardContent></Card></Box></Stack>;
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'blue' | 'orange' | 'green' | 'red' }) {
  const colors = { blue: '#14a6a6', orange: '#ffb547', green: '#00a95c', red: '#df635d' };
  return <Paper sx={{ p: 2.5, border: '1px solid #e6edf0', borderTop: `3px solid ${colors[tone]}` }}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h3" sx={{ mt: 1, fontSize: 34 }}>{value}</Typography><Typography variant="caption" color="text.secondary">{detail}</Typography></Paper>;
}

export default App;