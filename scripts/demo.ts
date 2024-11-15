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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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
    await sleep(3000);

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

    // キュレーション機能フェーズを追加
    console.log("\n🎨 フェーズ6: キュレーション機能");
    
    // キュレーターによるプレイリスト作成
    await displayTask(
        "キュレーションプレイリストの作成",
        "キュレーター（ユーザー1）",
        async () => {
            const tx = await musicStreaming.connect(user1).createCuratedPlaylist(
                "おすすめJazz 2024",
                "ジャズの名曲セレクション",
                [1], // 既存の音楽NFTを含める
                true // 公開プレイリスト
            );
            await tx.wait();
            const playlist = await musicStreaming.playlists(1);
            console.log(`作成されたプレイリスト: ${playlist.name}`);
            console.log(`キュレーター: ${playlist.creator}`);
        }
    );
    await sleep(3000);

    // プレイリストへのいいね
    await displayTask(
        "プレイリストへのいいね",
        "一般ユーザー2",
        async () => {
            const tx = await musicStreaming.connect(user2).likePlaylist(1);
            await tx.wait();
            const playlist = await musicStreaming.playlists(1);
            console.log(`プレイリストのいいね数: ${playlist.likeCount}`);
        }
    );
    await sleep(3000);

    // プレイリストのフォロー
    await displayTask(
        "プレイリストのフォロー",
        "一般ユーザー2",
        async () => {
            const tx = await musicStreaming.connect(user2).followPlaylist(1);
            await tx.wait();
            const followerCount = await musicStreaming.getPlaylistFollowerCount(1);
            console.log(`プレイリストのフォロワー数: ${followerCount}`);
        }
    );
    await sleep(3000);

    // キュレーター評価の確認
    await displayTask(
        "キュレーター評価の確認",
        "システム",
        async () => {
            const curatorStats = await musicStreaming.curatorStats(user1.address);
            console.log("キュレーター統計:", {
                総いいね数: curatorStats.totalLikes.toString(),
                フォロワー数: curatorStats.totalFollowers.toString(),
                プレイリスト数: curatorStats.playlistCount.toString(),
                評価スコア: curatorStats.reputation.toString()
            });
        }
    );
    await sleep(3000);

    // 人気のキュレーター表示
    await displayTask(
        "人気キュレーターのランキング",
        "システム",
        async () => {
            const curators = await musicStreaming.getCurators();
            const curatorStatsList = [];

            for (const curator of curators) {
                const stats = await musicStreaming.curatorStats(curator);
                curatorStatsList.push({
                    address: curator,
                    reputation: stats.reputation, // .toNumber()を削除
                });
            }

            // 評価スコアの降順でソート
            curatorStatsList.sort((a, b) => {
                const reputationA = Number(a.reputation); // 数値に変換
                const reputationB = Number(b.reputation); // 数値に変換
                return reputationB - reputationA;
            });

            console.log("人気キュレーターのランキング:");
            curatorStatsList.forEach((curator, index) => {
                console.log(
                    `順位 ${index + 1}: ${curator.address} - 評価スコア: ${curator.reputation}`
                );
            });
        }
    );
    await sleep(3000);

    // 最終状態レポートの前にfinalStatusを初期化
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

    // 音楽の人気度確認
    await displayTask(
        "音楽の人気度確認",
        "システム",
        async () => {
            const popularity = await musicStreaming.musicPopularityScore(1);
            const appearances = await musicStreaming.getPlaylistAppearances(1);
            const streamHistory = await musicStreaming.getStreamHistory(1);
            const likes = await musicStreaming.likesCount(1);
            
            console.log("音楽統計:", {
                人気度スコア: popularity.toString(),
                プレイリスト登場回数: appearances.toString(),
                ストリーミング回数: streamHistory.length.toString(),
                いいね数: likes.toString()
            });
        }
    );

    // 最終状態レポート
    console.log("\n📊 キュレーション機能の統計");
    const curationStatus = await displayTask(
        "キュレーション統計情報の収集",
        "システム",
        async () => {
            const curatorStats = await musicStreaming.curatorStats(user1.address);
            const playlistCount = await musicStreaming.getUserPlaylistCount(user1.address);
            
            return {
                totalCurators: (await musicStreaming.getTopCurators()).length,
                playlistsCreated: playlistCount,
                curatorReputation: curatorStats.reputation,
                totalFollowers: curatorStats.totalFollowers
            };
        }
    );

    // 最終レポートにキュレーション情報を追加
    console.log("\n🎵 キュレーション情報:");
    console.log(`総キュレーター数: ${curationStatus.totalCurators}名`);
    console.log(`作成プレイリスト数: ${curationStatus.playlistsCreated}個`);
    console.log(`キュレーター評価: ${curationStatus.curatorReputation}ポイント`);
    console.log(`総フォロワー数: ${curationStatus.totalFollowers}名`);

    // 最終状態レポート
    console.log("\n📊 最終状態レポート");
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
