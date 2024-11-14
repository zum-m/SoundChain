import { ethers } from "hardhat";
import { Contract } from "ethers";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function displayTask(taskName: string, role: string, action: () => Promise<any>) {
    console.log(`\n📋 タスク: ${taskName}`);
    console.log(`👤 実行者: ${role}`);
    console.log("⏳ 開始中...");
    
    try {
        const result = await action();
        console.log("✅ 正常に完了しました！");
        return result;
    } catch (error) {
        console.log("❌ 失敗しました！");
        throw error;
    }
}

async function main() {
    console.log("=".repeat(50));
    console.log("🎵 音楽ストリーミングDAppデモを開始します");
    console.log("=".repeat(50));

    const [owner, artist, user1, user2] = await ethers.getSigners();
    console.log("\n👥 参加者一覧:");
    console.log(`システム管理者: ${owner.address}`);
    console.log(`アーティスト（クリエイター）: ${artist.address}`);
    console.log(`一般ユーザー1（リスナー）: ${user1.address}`);
    console.log(`一般ユーザー2（リスナー）: ${user2.address}`);

    // アーティストの初期残高を記録
    const initialArtistBalance = await ethers.provider.getBalance(artist.address);
    console.log("\n💰 アーティスト残高情報:");
    console.log(`初期残高: ${ethers.formatEther(initialArtistBalance)} ETH`);

    // コントラクトデプロイフェーズ
    console.log("\n🚀 フェーズ1: システムのデプロイ（管理者操作）");
    
    const musicNFT = await displayTask(
        "MusicNFTコントラクトのデプロイ",
        "システム管理者",
        async () => {
            const MusicNFT = await ethers.getContractFactory("MusicNFT");
            const contract = await MusicNFT.deploy();
            await contract.waitForDeployment();
            return contract;
        }
    );
    console.log(`📍 MusicNFTアドレス: ${await musicNFT.getAddress()}`);
    await sleep(5000);

    const rightsManager = await displayTask(
        "RightsManagerコントラクトのデプロイ",
        "システム管理者",
        async () => {
            const RightsManager = await ethers.getContractFactory("RightsManager");
            const contract = await RightsManager.deploy(await musicNFT.getAddress());
            await contract.waitForDeployment();
            return contract;
        }
    );
    console.log(`📍 RightsManagerアドレス: ${await rightsManager.getAddress()}`);
    await sleep(5000);

    const musicStreaming = await displayTask(
        "MusicStreamingコントラクトのデプロイ",
        "システム管理者",
        async () => {
            const MusicStreaming = await ethers.getContractFactory("MusicStreaming");
            const contract = await MusicStreaming.deploy(await rightsManager.getAddress());
            await contract.waitForDeployment();
            return contract;
        }
    );
    console.log(`📍 MusicStreamingアドレス: ${await musicStreaming.getAddress()}`);
    await sleep(5000);

    // MusicStreamingコントラクトのアドレスを設定
    await displayTask(
        "RightsManagerの設定",
        "システム管理者",
        async () => {
            const tx = await rightsManager.connect(owner).setMusicStreamingContract(
                await musicStreaming.getAddress()
            );
            await tx.wait();
            console.log("MusicStreamingコントラクトのアドレスを設定しました");
        }
    );
    await sleep(5000);

    // NFT作成フェーズ
    console.log("\n🎨 フェーズ2: 音楽コンテンツの登録（アーティスト操作）");
    await displayTask(
        "音楽NFTのミント",
        "アーティスト",
        async () => {
            const tx = await musicNFT.connect(artist).mintMusic("ipfs://QmTest123");
            await tx.wait();
            const tokenURI = await musicNFT.tokenURI(1);
            console.log(`トークンID: 1, URI: ${tokenURI}`);
        }
    );
    await sleep(5000);

    // 収益追跡用の変数
    let totalRoyalties = BigInt(0);
    let totalStreamingPayments = BigInt(0);

    // ライセンス管理フェーズ
    console.log("\n📜 フェーズ3: ライセンス管理");
    await displayTask(
        "ライセンス条件の設定",
        "アーティスト",
        async () => {
            const tx = await rightsManager.connect(artist).setLicenseTerms(
                1,
                ethers.parseEther("0.1"),
                true,
                86400,
                0,
                100,
                1000
            );
            await tx.wait();
            console.log("ライセンス条件:", {
                価格: "0.1 ETH",
                期間: "24時間",
                最大再生回数: "100回",
                ロイヤリティ: "10%"
            });
        }
    );
    await sleep(5000);

    // ライセンス購入時の支払い追跡
    await displayTask(
        "ライセンスの購入",
        "一般ユーザー1",
        async () => {
            const tx = await rightsManager.connect(user1).purchaseLicense(1, 0, {
                value: ethers.parseEther("0.1")
            });
            const receipt = await tx.wait();
            
            // RoyaltyPaidイベントを探す
            const royaltyPaidEvents = receipt.logs.filter((log: any) => {
                try {
                    const parsed = rightsManager.interface.parseLog({
                        topics: log.topics,
                        data: log.data
                    });
                    return parsed?.name === "RoyaltyPaid";
                } catch {
                    return false;
                }
            });

            // イベントから支払額を取得
            if (royaltyPaidEvents.length > 0) {
                const parsedEvent = rightsManager.interface.parseLog({
                    topics: royaltyPaidEvents[0].topics,
                    data: royaltyPaidEvents[0].data
                });
                totalRoyalties += parsedEvent.args.amount;
            }

            const hasLicense = await rightsManager.hasValidLicense(user1.address, 1);
            console.log(`ライセンス状態: ${hasLicense ? '有効' : '無効'}`);
            console.log(`支払われたロイヤリティ: ${ethers.formatEther(totalRoyalties)} ETH`);
        }
    );
    await sleep(5000);

    // ストリーミングフェーズ
    console.log("\n🎧 フェーズ4: 音楽ストリーミング（ユーザー1の操作）");
    // ストリーミング時の支払い追跡
    await displayTask(
        "ストリーミング開始",
        "一般ユーザー1",
        async () => {
            const streamPayment = ethers.parseEther("0.001");
            const tx = await musicStreaming.connect(user1).startStream(1, {
                value: streamPayment
            });
            await tx.wait();
            totalStreamingPayments += streamPayment;
            console.log("ストリーミングを開始しました");
            console.log(`ストリーミング支払額: ${ethers.formatEther(streamPayment)} ETH`);
        }
    );
    await sleep(5000);

    await displayTask(
        "ストリーミング終了",
        "一般ユーザー1",
        async () => {
            const tx = await musicStreaming.connect(user1).endStream(1);
            await tx.wait();
            const history = await musicStreaming.getStreamHistory(1);
            console.log(`再生時間: ${history[0].duration.toString()}秒`);
        }
    );
    await sleep(5000);

    // ソーシャル機能フェーズ
    console.log("\n🤝 フェーズ5: ソーシャル機能");
    await displayTask(
        "プレイリストの作成",
        "一般ユーザー1",
        async () => {
            const tx = await musicStreaming.connect(user1).createPlaylist("お気に入りの曲", true);
            await tx.wait();
            console.log("プレイリストを作成しました");
        }
    );
    await sleep(5000);

    await displayTask(
        "いいね機能",
        "一般ユーザー2",
        async () => {
            const tx = await musicStreaming.connect(user2).likeMusic(1);
            await tx.wait();
            const likes = await musicStreaming.likesCount(1);
            console.log(`総いいね数: ${likes}`);
        }
    );

    // 最終状態レポート
    console.log("\n📊 最終状態レポート");
    const finalStatus = await displayTask(
        "統計情報の収集",
        "システム",
        async () => {
            const hasLicense = await rightsManager.hasValidLicense(user1.address, 1);
            const streamHistory = await musicStreaming.getStreamHistory(1);
            const likes = await musicStreaming.likesCount(1);
            const finalArtistBalance = await ethers.provider.getBalance(artist.address);
            const totalEarnings = finalArtistBalance - initialArtistBalance;
            
            return {
                hasLicense,
                streamCount: streamHistory.length,
                likeCount: likes,
                totalEarnings,
                totalRoyalties,
                totalStreamingPayments
            };
        }
    );

    console.log("\n=".repeat(50));
    console.log("📈 デモ実行結果:");
    console.log("-".repeat(30));
    console.log("🎵 コンテンツ情報:");
    console.log(`NFT所有者: ${artist.address}`);
    console.log(`ライセンス保持者: ${user1.address}`);
    console.log(`ライセンス状態: ${finalStatus.hasLicense ? '有効' : '無効'}`);
    
    console.log("\n🎧 利用状況:");
    console.log(`ストリーミング回数: ${finalStatus.streamCount}回（ユーザー1）`);
    console.log(`いいね数: ${finalStatus.likeCount}件（ユーザー2による）`);
    
    console.log("\n💰 アーティスト収益情報:");
    console.log(`総収益: ${ethers.formatEther(finalStatus.totalEarnings)} ETH`);
    console.log(`└ ライセンスロイヤリティ: ${ethers.formatEther(finalStatus.totalRoyalties)} ETH`);
    console.log(`└ ストリーミング収益: ${ethers.formatEther(finalStatus.totalStreamingPayments)} ETH`);
    
    const finalArtistBalance = await ethers.provider.getBalance(artist.address);
    console.log("\n💳 アーティスト残高変動:");
    console.log(`初期残高: ${ethers.formatEther(initialArtistBalance)} ETH`);
    console.log(`最終残高: ${ethers.formatEther(finalArtistBalance)} ETH`);
    console.log(`増減: ${ethers.formatEther(finalArtistBalance - initialArtistBalance)} ETH`);
    console.log("=".repeat(50));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ デモ実行エラー:");
        console.error(error);
        process.exit(1);
    });
