import { render, screen } from '@testing-library/react'
import { MasterAvatar } from './MasterAvatar'
import { getMasterColor } from '../pages/dashboard/masterColor'

describe('MasterAvatar', () => {
  it('renders the photo as an image when the master has one', () => {
    const { container } = render(
      <MasterAvatar master={{ id: 'master-1', name: 'Anna Master', photo: 'data:image/png;base64,abc' }} />,
    )

    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,abc')
  })

  it('falls back to initials on the master color when there is no photo', () => {
    const { container } = render(<MasterAvatar master={{ id: 'master-1', name: 'Anna Master', photo: null }} />)

    expect(container.querySelector('img')).not.toBeInTheDocument()
    const placeholder = screen.getByText('AM')
    expect(placeholder).toHaveStyle({ backgroundColor: getMasterColor('master-1') })
  })

  it('takes at most two initials from a longer name', () => {
    render(<MasterAvatar master={{ id: 'master-1', name: 'Anna Maria Master', photo: null }} />)

    expect(screen.getByText('AM')).toBeInTheDocument()
  })
})
