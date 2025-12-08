import { ReactNode } from 'react'
import { JobCard, JobCardJob } from '@/components/JobCard'

interface JobsGridProps {
  jobs: JobCardJob[]
  showUser?: boolean
  showOrphaned?: boolean
  onAssign?: (job: JobCardJob) => void
  renderActions?: (job: JobCardJob) => ReactNode
}

export function JobsGrid({ jobs, showUser = false, showOrphaned = false, onAssign, renderActions }: JobsGridProps) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          showUser={showUser}
          showOrphaned={showOrphaned}
          onAssign={onAssign}
          renderActions={renderActions}
        />
      ))}
    </div>
  )
}
