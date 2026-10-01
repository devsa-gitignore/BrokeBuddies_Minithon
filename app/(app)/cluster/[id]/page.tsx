import { ClusterDetail } from '@/components/app/cluster-detail'

type Props = { params: Promise<{ id: string }> }

export const metadata = {
  title: 'Story Cluster',
  description: 'Full timeline and AI synthesis for a grouped news story.',
}

export default async function ClusterPage({ params }: Props) {
  const { id } = await params
  return <ClusterDetail id={id} />
}
