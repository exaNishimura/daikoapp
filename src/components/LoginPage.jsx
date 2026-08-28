import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/Layout'
import { useAuth } from '@/contexts/AuthContext'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { sendMagicLink, isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (isAuthenticated) {
    const from = location.state?.from?.pathname || '/shift/edit'
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    try {
      const result = await sendMagicLink(email.trim())
      if (result.success) {
        setInfo(`${email.trim()} 宛にログインリンクを送信しました。メールを確認してください。`)
        setEmail('')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message || 'ログインに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Center height="100%" padding={4}>
      <Card padding={4} width="100%">
        <VStack gap={4} as="form" onSubmit={handleSubmit} noValidate>
          <VStack gap={2} hAlign="center">
            <Heading level={1}>ログイン</Heading>
            <Text color="secondary">
              登録済みのメールアドレスを入力すると、ログイン用のリンクをメールで送信します。
            </Text>
          </VStack>

          {error ? (
            <Banner
              status="error"
              title={error}
              isDismissable
              onDismiss={() => setError(null)}
              collapsible={false}
            />
          ) : null}
          {info ? (
            <Banner
              status="success"
              title={info}
              isDismissable
              onDismiss={() => setInfo(null)}
              collapsible={false}
            />
          ) : null}

          <TextInput
            label="メールアドレス"
            type="email"
            value={email}
            onChange={setEmail}
            isRequired
            hasAutoFocus
            isDisabled={submitting}
            width="100%"
          />
          <Button
            type="submit"
            variant="primary"
            width="100%"
            isDisabled={submitting || !email}
            isLoading={submitting}
            label={submitting ? '送信中...' : 'ログインリンクを送信'}
          />
        </VStack>
      </Card>
    </Center>
  )
}
