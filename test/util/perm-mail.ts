/* eslint-disable no-console */
import { ImapFlow } from 'imapflow';
import waitFor from 'p-wait-for';

/**
 * Simple IMAP client to wait for an email on a mailbox
 */
export default class PermMail {
  private imap: ImapFlow;

  private latestSeq = 0;

  private recentEmail: FetchMessageObject | null = null;

  private pollInterval: number;

  public addressName: string;

  public addressHost: string;

  constructor(pollInterval?: number) {
    this.imap = new ImapFlow({
      host: process.env.PERMANENT_EMAIL_HOST || '',
      port: Number(process.env.PERMANENT_EMAIL_PORT || 993),
      secure: true,
      tls: {},
      auth: {
        user: process.env.PERMANENT_EMAIL_USER || '',
        pass: process.env.PERMANENT_EMAIL_PASS || '',
      },
      logger: false,
    });
    this.pollInterval = pollInterval || 20000;
    this.addressName = process.env.PERMANENT_EMAIL_ADDRESS || 'missing';
    this.addressHost = process.env.PERMANENT_EMAIL_ADDRESS_HOST || 'missing';
  }

  public async init(): Promise<void> {
    return this.imap.connect();
  }

  public async logout(): Promise<void> {
    return this.imap.logout();
  }

  private async getLatestEmail(): Promise<void> {
    await this.imap.mailboxOpen('INBOX');
    const msg = await this.imap.fetchOne('*', { source: {} });
    console.log('latest email:', msg);
    this.latestSeq = msg.seq;
  }

  private async isNewEmail(): Promise<boolean> {
    await this.imap.mailboxOpen('INBOX');
    const sequenceString = `${this.latestSeq + 1}`;
    console.log('fetching with sequence string:', sequenceString);
    const msg = (await this.imap.fetchOne(sequenceString, {
      source: {},
      envelope: true,
    })) as FetchMessageObject | false;
    console.log('fetch result', msg);
    if (msg) {
      this.recentEmail = msg;
      return true;
    }
    return false;
  }

  public async waitForEmail(): Promise<FetchMessageObject | null> {
    await this.imap.connect();
    await this.getLatestEmail();
    await waitFor(this.isNewEmail.bind(this), {
      interval: this.pollInterval,
    });
    if (this.recentEmail) {
      console.log('recent email:', this.recentEmail);
      this.latestSeq = this.recentEmail.seq;
      const email = this.recentEmail;
      this.recentEmail = null;
      await this.imap.logout();
      return email;
    }
    await this.imap.logout();
    return null;
  }
}
