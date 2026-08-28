import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import { useAuth } from '@/contexts/AuthContext'
import { filterVisibleCategories } from '@/lib/navConfig'
import { getActiveWorkDate, formatWorkDateKey } from '@/utils/businessDayUtils'

export function DashboardPage() {
  const { isAuthenticated } = useAuth()
  const categories = filterVisibleCategories(isAuthenticated)
  const workDateLabel = formatWorkDateKey(getActiveWorkDate())

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflowY: 'auto',
        bgcolor: '#f4f6f8',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: '#1f2733', mb: 0.5 }}>
          総合ダッシュボード
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          営業日: {workDateLabel}
        </Typography>

        <Grid container spacing={2}>
          {categories.map((category) => (
            <Grid item xs={12} md={6} key={category.id}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  border: '1px solid #e3e7ec',
                  borderRadius: 2,
                  height: '100%',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1f2733', mb: 0.5 }}>
                  {category.label}
                </Typography>
                {category.description ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {category.description}
                  </Typography>
                ) : null}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {category.items.map((item) => (
                    <Button
                      key={item.to}
                      component={Link}
                      to={item.to}
                      variant="outlined"
                      size="small"
                      sx={{
                        borderColor: '#c5cad3',
                        color: '#1f2733',
                        '&:hover': {
                          borderColor: '#5b61e6',
                          backgroundColor: 'rgba(91, 97, 230, 0.06)',
                        },
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {!isAuthenticated && (
          <Paper
            elevation={0}
            sx={{
              mt: 3,
              p: 2,
              border: '1px solid #e3e7ec',
              borderRadius: 2,
              bgcolor: '#fff',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              シフト編集・売上管理などは右上の「ログイン」から管理者として入ってください。
            </Typography>
          </Paper>
        )}
      </Container>
    </Box>
  )
}
