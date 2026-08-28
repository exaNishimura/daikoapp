import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Grid } from '@astryxdesign/core/Grid'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack, VStack } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { useAuth } from '@/contexts/AuthContext'
import { PageFrame } from '@/components/PageFrame'
import { filterVisibleCategories } from '@/lib/navConfig'
import { getActiveWorkDate, formatWorkDateKey } from '@/utils/businessDayUtils'

export function DashboardPage() {
  const { isAuthenticated } = useAuth()
  const categories = filterVisibleCategories(isAuthenticated)
  const workDateLabel = formatWorkDateKey(getActiveWorkDate())

  return (
    <PageFrame>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={1}>総合ダッシュボード</Heading>
          <Text color="secondary">営業日: {workDateLabel}</Text>
        </VStack>

        <Grid columns={{ minWidth: 320, max: 2 }} gap={2}>
          {categories.map((category) => (
            <Card key={category.id} padding={4} height="100%">
              <VStack gap={3}>
                <VStack gap={1}>
                  <Heading level={3}>{category.label}</Heading>
                  {category.description ? (
                    <Text color="secondary">{category.description}</Text>
                  ) : null}
                </VStack>
                <HStack gap={1} wrap="wrap">
                  {category.items.map((item) => (
                    <Button
                      key={item.to}
                      href={item.to}
                      label={item.label}
                      variant="secondary"
                      size="sm"
                    />
                  ))}
                </HStack>
              </VStack>
            </Card>
          ))}
        </Grid>

        {!isAuthenticated ? (
          <Banner
            status="info"
            title="シフト編集・売上管理などは右上の「ログイン」から管理者として入ってください。"
            collapsible={false}
          />
        ) : null}
      </VStack>
    </PageFrame>
  )
}
