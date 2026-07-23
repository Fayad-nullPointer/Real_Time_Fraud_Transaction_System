# Step-by-Step AWS Hosting Guide for Real-Time Fraud Detection System

This guide walks you through deploying your full project on **AWS EC2** using your **$80 credit**.

---

## 1. Instance Sizing & Cost Management

- **Instance Type**: `t3.small` (2 vCPUs, 2 GB RAM) — *Perfect fit for AWS Free Tier / Credit savings*
- **Storage**: 30 GB gp3 (EBS)
- **OS**: Ubuntu 22.04 LTS (x86_64) or Ubuntu 24.04 LTS
- **Estimated Cost**: ~$0.0208/hr (~$15/month or FREE with AWS Free Tier allowance). Your **$80 AWS credit** will run this for **5+ months**!
- **Tip**: You can stop the instance in the AWS Console whenever you are not actively using or demonstrating it to pause hourly charges.

---

## 2. Launching your EC2 Instance (AWS Console)

1. Log into your [AWS Management Console](https://console.aws.amazon.com/).
2. Navigate to **EC2** -> Click **Launch Instance**.
3. **Name**: `fraud-detection-app`
4. **Application and OS Image**: Select **Ubuntu** (Ubuntu Server 22.04 LTS or 24.04 LTS).
5. **Instance Type**: Select `t3.small` (or `t2.micro` / `t3.micro` if strictly sticking to free tier, though `t3.small` runs smoother).
6. **Key Pair (SSH)**:
   - Select an existing key pair or click **Create new key pair** (e.g. name it `fraud-key.pem`).
   - Download the `.pem` file to your computer.
7. **Network Settings (Security Group)**:
   - Click **Edit** next to Network settings.
   - Add the following **Inbound Security Group Rules**:
     | Type | Protocol | Port Range | Source | Purpose |
     | --- | --- | --- | --- | --- |
     | SSH | TCP | `22` | Anywhere (`0.0.0.0/0`) or My IP | SSH access |
     | Custom TCP | TCP | `3000` | Anywhere (`0.0.0.0/0`) | React Frontend UI |
     | Custom TCP | TCP | `8005` | Anywhere (`0.0.0.0/0`) | FastAPI Backend & WebSockets |
8. **Configure Storage**:
   - Set size to **30 GB** (gp3).
9. Click **Launch Instance**.

---

## 3. Connecting to your EC2 Instance

Open your local terminal and connect to your EC2 instance using SSH:

```bash
chmod 400 /path/to/fraud-key.pem
ssh -i /path/to/fraud-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
```

*(Replace `<YOUR-EC2-PUBLIC-IP>` with the IPv4 Public IP shown on your EC2 instance dashboard).*

---

## 4. Deploying the Application

Once connected to your EC2 instance terminal, run:

```bash
# 1. Clone your project repository (or transfer files)
git clone <YOUR-GITHUB-REPO-URL> project
cd project

# 2. Make the script executable and run it
chmod +x deploy_aws.sh
./deploy_aws.sh
```

---

## 5. Accessing your Live Application

Once `deploy_aws.sh` finishes running:
- 🌐 **Web UI**: `http://<YOUR-EC2-PUBLIC-IP>:3000`
- ⚙️ **Swagger API Docs**: `http://<YOUR-EC2-PUBLIC-IP>:8005/docs`

---

## 6. Useful Commands on EC2

- **Check container status**:
  ```bash
  sudo docker compose ps
  ```
- **View live logs**:
  ```bash
  sudo docker compose logs -f
  ```
- **Restart application**:
  ```bash
  sudo docker compose restart
  ```
- **Stop containers**:
  ```bash
  sudo docker compose down
  ```
