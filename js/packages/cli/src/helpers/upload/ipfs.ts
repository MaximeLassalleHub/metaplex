import log from 'loglevel';
import fetch from 'node-fetch';
import { create, globSource } from 'ipfs-http-client';
import path from 'path';

export interface ipfsCreds {
  projectId: string;
  secretKey: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function ipfsUpload(
  ipfsCredentials: ipfsCreds,
  image: string,
  animation: string,
  manifestBuffer: Buffer,
) {
  const tokenIfps = `${ipfsCredentials.projectId}:${ipfsCredentials.secretKey}`;
  // @ts-ignore
  const cloudfare = "https://cloudflare-ipfs.com"
  const infura = "https://ipfs.infura.io:5001"
  const custom = "https://ipfs.gama-smartweb.com"
  const ipfsNetwork = custom
  // @ts-ignore
  const ipfs = create(ipfsNetwork);
  const authIFPS = Buffer.from(tokenIfps).toString('base64');

  const uploadToIpfs = async source => {
    const { cid } = await ipfs.add(source).catch();
    await sleep(10000);
    return cid;
  };

  async function uploadMedia(media) {
    const mediaHash = await uploadToIpfs(
      globSource(media, { recursive: true }),
    );
    log.debug('mediaHash:', mediaHash);
    const mediaUrl = `${ipfsNetwork}/ipfs/${mediaHash}`;
    log.info('mediaUrl:', mediaUrl);
    await fetch(`${ipfsNetwork}/api/v0/pin/add?arg=${mediaHash}`, {
      headers: {
        Authorization: `Basic ${authIFPS}`,
      },
      method: 'POST',
    });
    log.info('uploaded media for file:', media);
    return mediaUrl;
  }

  const imageUrl = `${await uploadMedia(image)}?ext=${path
    .extname(image)
    .replace('.', '')}`;
  const animationUrl = animation
    ? `${await uploadMedia(animation)}?ext=${path
      .extname(animation)
      .replace('.', '')}`
    : undefined;
  const manifestJson = JSON.parse(manifestBuffer.toString('utf8'));
  manifestJson.image = imageUrl;
  if (animation) {
    manifestJson.animation_url = animationUrl;
  }

  const manifestHash = await uploadToIpfs(
    Buffer.from(JSON.stringify(manifestJson)),
  );
  await fetch(
    `${ipfsNetwork}/api/v0/pin/add?arg=${manifestHash}`,
    {
      headers: {
        Authorization: `Basic ${authIFPS}`,
      },
      method: 'POST',
    },
  );

  const link = `${ipfsNetwork}/ipfs/${manifestHash}`;
  log.info('uploaded manifest: ', link);

  return [link, imageUrl, animationUrl];
}
