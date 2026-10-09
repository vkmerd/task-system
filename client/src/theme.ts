import { createTheme, responsiveFontSizes } from '@mui/material/styles';

let theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: '#00a95c', dark: '#007a42', light: '#bcefd7' },
    secondary: { main: '#ffb547' },
    background: { default: '#f5f7f8', paper: '#ffffff' },
    text: { primary: '#15171a', secondary: '#68737d' },
  },
  typography: {
    fontFamily: '"Poppins", sans-serif',
    h1: { fontFamily: '"Poppins", sans-serif', fontWeight: 800, letterSpacing: '-.04em' },
    h2: { fontFamily: '"Poppins", sans-serif', fontWeight: 800, letterSpacing: '-.04em' },
    h3: { fontFamily: '"Poppins", sans-serif', fontWeight: 800, letterSpacing: '-.035em' },
    h4: { fontFamily: '"Poppins", sans-serif', fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { textTransform: 'none', fontWeight: 700, borderRadius: 10 } } },
    MuiCard: { styleOverrides: { root: { border: '1px solid #e4e8eb', borderRadius: 16, boxShadow: '0 3px 14px rgba(15, 23, 42, 0.045)' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0d0e10',
          '& > .MuiBox-root': { backgroundColor: '#0d0e10 !important', color: '#ffffff' },
          '& .MuiDivider-root': { borderColor: '#25282b' },
        },
      },
    },
  },
});

theme = responsiveFontSizes(theme, { factor: 4 });
export { theme };