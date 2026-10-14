import { useNavigate } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { Button, Card, CardBody, CuteEmptyState } from '@/components/ui'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <Card>
      <CardBody>
        <CuteEmptyState
          mascot="cat-box"
          size="lg"
          title="This page wandered off"
          description="The link you followed does not match anything in your planner. Nothing was lost — your records are safe in local storage."
          action={
            <>
              <Button onClick={() => navigate('/')}>
                <Home />
                Back to the dashboard
              </Button>
              <Button variant="outline" onClick={() => navigate('/calendar')}>
                <Compass />
                Open the calendar
              </Button>
            </>
          }
        />
      </CardBody>
    </Card>
  )
}
